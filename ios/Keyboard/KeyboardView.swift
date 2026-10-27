import UIKit
import VoxlenCore

@MainActor
protocol KeyboardViewDelegate: AnyObject {
    func keyboardView(_ view: KeyboardView, didTap key: KeyKind)
    func keyboardViewDidDoubleTapShift(_ view: KeyboardView)
    /// Delete was pressed; called again for each auto-repeat while held.
    func keyboardViewDidRepeatDelete(_ view: KeyboardView)
}

enum ShiftState {
    case off, on, locked
}

/// Draws the keys and handles touches itself, so a touch between two keys
/// still lands on the nearest one, as on the system keyboard. The globe key
/// is a real UIButton, because `handleInputModeList(from:with:)` needs its
/// touch events.
final class KeyboardView: UIView {
    weak var delegate: KeyboardViewDelegate?
    let globeButton = UIButton(type: .custom)

    var page: KeyboardPage = .letters { didSet { if page != oldValue { rebuild() } } }
    var shiftState: ShiftState = .off { didSet { if shiftState != oldValue { refreshLabels() } } }
    var showsGlobe = true { didSet { if showsGlobe != oldValue { rebuild() } } }
    var returnTitle = "return" { didSet { refreshLabels() } }
    var returnIsPrimary = false { didSet { refreshLabels() } }

    private struct Cap {
        let kind: KeyKind
        let view: KeyCapView
        var frame: CGRect = .zero
    }

    private var rows: [[Cap]] = []
    private var activeTouch: (touch: UITouch, kind: KeyKind)?
    private var deleteRepeat: Task<Void, Never>?
    private var lastShiftTap: Date?
    private let preview = KeyPreviewView()

    private var isPad: Bool { traitCollection.userInterfaceIdiom == .pad }
    private var isCompactHeight: Bool { traitCollection.verticalSizeClass == .compact }
    var rowHeight: CGFloat { isPad ? 62 : (isCompactHeight ? 38 : 54) }

    override init(frame: CGRect) {
        super.init(frame: frame)
        isMultipleTouchEnabled = false
        globeButton.setImage(UIImage(systemName: "globe"), for: .normal)
        globeButton.tintColor = .label
        globeButton.backgroundColor = KeyCapView.specialColor
        globeButton.layer.cornerRadius = 5
        globeButton.accessibilityLabel = "Next keyboard"
        preview.isHidden = true
        rebuild()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: rowHeight * 4 + 8)
    }

    // MARK: Building

    private func rebuild() {
        rows.flatMap { $0 }.forEach { $0.view.removeFromSuperview() }
        globeButton.removeFromSuperview()
        rows = KeyboardLayout.rows(for: page).map { row in
            row.filter { $0 != .globe || showsGlobe }.map { kind in
                let view = KeyCapView(kind: kind)
                addSubview(view)
                return Cap(kind: kind, view: view)
            }
        }
        if showsGlobe {
            addSubview(globeButton)
        }
        addSubview(preview)
        refreshLabels()
        setNeedsLayout()
    }

    private func refreshLabels() {
        let upper = shiftState != .off
        for cap in rows.flatMap({ $0 }) {
            switch cap.kind {
            case .character(let c):
                cap.view.title = upper && page == .letters ? c.uppercased() : c
            case .shift:
                cap.view.symbol = shiftState == .locked ? "capslock.fill" : (shiftState == .on ? "shift.fill" : "shift")
            case .delete:
                cap.view.symbol = "delete.left"
            case .page(let target):
                cap.view.title = switch target {
                case .letters: "ABC"
                case .numbers: "123"
                case .symbols: "#+="
                }
            case .space:
                cap.view.title = "space"
            case .returnKey:
                cap.view.title = returnTitle
                cap.view.isPrimary = returnIsPrimary
            case .globe:
                break
            }
        }
    }

    // MARK: Layout

    override func layoutSubviews() {
        super.layoutSubviews()
        let margin: CGFloat = isPad ? 6 : 3
        let gap: CGFloat = isPad ? 12 : 6
        let vgap: CGFloat = isPad ? 10 : (isCompactHeight ? 6 : 11)
        let width = bounds.width - margin * 2
        let unit = (width - gap * 9) / 10
        let keyHeight = rowHeight - vgap

        for (r, row) in rows.enumerated() {
            let y = 4 + CGFloat(r) * rowHeight + vgap / 2
            var frames: [CGRect]
            switch r {
            case 0, 1:
                // Character rows; a shorter row (the middle letter row) is centred.
                let rowWidth = unit * CGFloat(row.count) + gap * CGFloat(row.count - 1)
                let x0 = margin + (width - rowWidth) / 2
                frames = row.indices.map { CGRect(x: x0 + CGFloat($0) * (unit + gap), y: y, width: unit, height: keyHeight) }
            case 2:
                // A wide key at each edge (shift or page, delete), characters centred between.
                let side = unit * 1.35
                let inner = width - side * 2 - gap * 2 * 1.5
                let count = CGFloat(row.count - 2)
                let charWidth = page == .letters ? unit : (inner - gap * (count - 1)) / count
                let block = charWidth * count + gap * (count - 1)
                let x0 = margin + (width - block) / 2
                frames = row.indices.map { i in
                    if i == 0 { return CGRect(x: margin, y: y, width: side, height: keyHeight) }
                    if i == row.count - 1 { return CGRect(x: margin + width - side, y: y, width: side, height: keyHeight) }
                    return CGRect(x: x0 + CGFloat(i - 1) * (charWidth + gap), y: y, width: charWidth, height: keyHeight)
                }
            default:
                // Bottom row: fixed keys, the space bar takes what is left.
                let widths: [CGFloat] = row.map { cap in
                    switch cap.kind {
                    case .page: unit * 1.25
                    case .globe: unit * 1.1
                    case .returnKey: unit * 2.3
                    default: 0
                    }
                }
                let fixed = widths.reduce(0, +) + gap * CGFloat(row.count - 1)
                var x = margin
                frames = widths.map { w in
                    let keyWidth = w == 0 ? max(unit * 3, width - fixed) : w
                    defer { x += keyWidth + gap }
                    return CGRect(x: x, y: y, width: keyWidth, height: keyHeight)
                }
            }
            for (i, frame) in frames.enumerated() {
                rows[r][i].frame = frame
                if rows[r][i].kind == .globe {
                    rows[r][i].view.frame = .zero
                    globeButton.frame = frame
                } else {
                    rows[r][i].view.frame = frame
                }
            }
        }
    }

    // MARK: Touches

    /// The key under the point, or the nearest key in the nearest row.
    private func key(at point: CGPoint) -> Cap? {
        guard !rows.isEmpty else { return nil }
        let r = min(max(Int((point.y - 4) / rowHeight), 0), rows.count - 1)
        return rows[r].filter { $0.kind != .globe }.min { a, b in
            distance(point, a.frame) < distance(point, b.frame)
        }
    }

    private func distance(_ p: CGPoint, _ rect: CGRect) -> CGFloat {
        let dx = max(rect.minX - p.x, 0, p.x - rect.maxX)
        let dy = max(rect.minY - p.y, 0, p.y - rect.maxY)
        return dx * dx + dy * dy
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard activeTouch == nil, let touch = touches.first, let cap = key(at: touch.location(in: self)) else { return }
        activeTouch = (touch, cap.kind)
        cap.view.isHighlighted = true
        if case .character = cap.kind, !isPad {
            preview.show(title: cap.view.title ?? "", over: cap.frame, in: bounds)
        }
        if cap.kind == .delete {
            delegate?.keyboardViewDidRepeatDelete(self)
            startDeleteRepeat()
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let active = activeTouch, touches.contains(active.touch), active.kind != .delete,
              let cap = key(at: active.touch.location(in: self)), cap.kind != active.kind else { return }
        // Sliding onto another key retargets the touch, as the system keyboard does.
        unhighlightAll()
        activeTouch = (active.touch, cap.kind)
        cap.view.isHighlighted = true
        if case .character = cap.kind, !isPad {
            preview.show(title: cap.view.title ?? "", over: cap.frame, in: bounds)
        } else {
            preview.isHidden = true
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let active = activeTouch, touches.contains(active.touch) else { return }
        finishTouch()
        switch active.kind {
        case .delete:
            break
        case .shift:
            let now = Date()
            if let last = lastShiftTap, now.timeIntervalSince(last) < 0.3 {
                lastShiftTap = nil
                delegate?.keyboardViewDidDoubleTapShift(self)
            } else {
                lastShiftTap = now
                delegate?.keyboardView(self, didTap: .shift)
            }
        default:
            delegate?.keyboardView(self, didTap: active.kind)
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        finishTouch()
    }

    private func finishTouch() {
        activeTouch = nil
        deleteRepeat?.cancel()
        deleteRepeat = nil
        preview.isHidden = true
        unhighlightAll()
    }

    private func unhighlightAll() {
        rows.flatMap { $0 }.forEach { $0.view.isHighlighted = false }
    }

    private func startDeleteRepeat() {
        deleteRepeat?.cancel()
        deleteRepeat = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(450))
            while !Task.isCancelled {
                guard let self else { return }
                self.delegate?.keyboardViewDidRepeatDelete(self)
                try? await Task.sleep(for: .milliseconds(90))
            }
        }
    }
}

/// One key cap: a rounded rectangle with a title or an SF Symbol.
final class KeyCapView: UIView {
    static let characterColor = UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.42, alpha: 1) : .white }
    static let specialColor = UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.27, alpha: 1) : UIColor(red: 0.67, green: 0.70, blue: 0.74, alpha: 1) }
    static let highlightColor = UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.55, alpha: 1) : UIColor(red: 0.80, green: 0.82, blue: 0.85, alpha: 1) }

    let kind: KeyKind
    private let label = UILabel()
    private let image = UIImageView()

    var title: String? {
        get { label.text }
        set { label.text = newValue; label.isHidden = newValue == nil; image.isHidden = newValue != nil }
    }

    var symbol: String? {
        didSet {
            image.image = symbol.flatMap { UIImage(systemName: $0) }
            image.isHidden = symbol == nil
            label.isHidden = symbol != nil
        }
    }

    var isHighlighted = false { didSet { updateColors() } }
    var isPrimary = false { didSet { updateColors() } }

    init(kind: KeyKind) {
        self.kind = kind
        super.init(frame: .zero)
        isUserInteractionEnabled = false
        layer.cornerRadius = 5
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 1)
        layer.shadowOpacity = 0.3
        layer.shadowRadius = 0
        label.textAlignment = .center
        label.adjustsFontSizeToFitWidth = true
        label.minimumScaleFactor = 0.6
        image.contentMode = .center
        image.tintColor = .label
        image.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 18, weight: .regular)
        addSubview(label)
        addSubview(image)
        if case .character = kind {
            label.font = .systemFont(ofSize: 24)
        } else {
            label.font = .systemFont(ofSize: 15)
        }
        isAccessibilityElement = true
        accessibilityTraits = .keyboardKey
        updateColors()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    override func layoutSubviews() {
        super.layoutSubviews()
        label.frame = bounds.insetBy(dx: 2, dy: 0)
        image.frame = bounds
    }

    override var accessibilityLabel: String? {
        get {
            switch kind {
            case .character: label.text
            case .shift: "Shift"
            case .delete: "Delete"
            case .space: "Space"
            case .returnKey: label.text
            case .page: label.text
            case .globe: "Next keyboard"
            }
        }
        set {}
    }

    private func updateColors() {
        let special: Bool = switch kind {
        case .character, .space: false
        default: true
        }
        if isPrimary {
            backgroundColor = isHighlighted ? Self.highlightColor : .systemBlue
            label.textColor = .white
        } else {
            backgroundColor = isHighlighted ? Self.highlightColor : (special ? Self.specialColor : Self.characterColor)
            label.textColor = .label
        }
    }
}

/// The enlarged letter shown above a key while it is pressed.
final class KeyPreviewView: UIView {
    private let label = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        backgroundColor = KeyCapView.characterColor
        layer.cornerRadius = 8
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.35
        layer.shadowRadius = 3
        layer.shadowOffset = CGSize(width: 0, height: 1)
        label.font = .systemFont(ofSize: 34)
        label.textAlignment = .center
        addSubview(label)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    func show(title: String, over key: CGRect, in bounds: CGRect) {
        label.text = title
        let width = key.width * 1.5
        let height = key.height * 1.25
        var x = key.midX - width / 2
        x = min(max(x, bounds.minX + 2), bounds.maxX - width - 2)
        frame = CGRect(x: x, y: key.minY - height - 4, width: width, height: height)
        label.frame = self.bounds
        isHidden = false
        superview?.bringSubviewToFront(self)
    }
}
