import UIKit

/// The strip above the keys: status on the left, Undo and Fix on the right.
final class FixBar: UIView {
    let fixButton = UIButton(type: .system)
    let undoButton = UIButton(type: .system)
    let applyButton = UIButton(type: .system)
    private let status = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private var clearStatus: Task<Void, Never>?

    static let brand = UIColor(red: 0.45, green: 0.27, blue: 0.82, alpha: 1)

    override init(frame: CGRect) {
        super.init(frame: frame)

        var fix = UIButton.Configuration.filled()
        fix.title = "Fix"
        fix.image = UIImage(systemName: "wand.and.stars")
        fix.imagePadding = 4
        fix.cornerStyle = .capsule
        fix.baseBackgroundColor = Self.brand
        fix.buttonSize = .small
        fixButton.configuration = fix
        fixButton.accessibilityHint = "Fixes spelling and grammar in the selection or the sentence before the cursor"

        var undo = UIButton.Configuration.gray()
        undo.title = "Undo"
        undo.image = UIImage(systemName: "arrow.uturn.backward")
        undo.imagePadding = 4
        undo.cornerStyle = .capsule
        undo.buttonSize = .small
        undoButton.configuration = undo
        undoButton.isHidden = true

        var apply = UIButton.Configuration.tinted()
        apply.title = "Apply"
        apply.cornerStyle = .capsule
        apply.buttonSize = .small
        applyButton.configuration = apply
        applyButton.isHidden = true

        status.font = .systemFont(ofSize: 13, weight: .medium)
        status.textColor = .secondaryLabel
        status.adjustsFontSizeToFitWidth = true
        status.minimumScaleFactor = 0.75
        status.text = "Voxlen"

        spinner.hidesWhenStopped = true

        let buttons = UIStackView(arrangedSubviews: [spinner, applyButton, undoButton, fixButton])
        buttons.spacing = 8
        buttons.alignment = .center
        let row = UIStackView(arrangedSubviews: [status, buttons])
        row.spacing = 8
        row.alignment = .center
        row.translatesAutoresizingMaskIntoConstraints = false
        status.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            row.centerYAnchor.constraint(equalTo: centerYAnchor),
            heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    var isWorking: Bool = false {
        didSet {
            fixButton.isEnabled = !isWorking
            if isWorking { spinner.startAnimating() } else { spinner.stopAnimating() }
        }
    }

    /// Shows a message; transient ones fade back to the idle label.
    func show(_ message: String, transient: Bool = true) {
        clearStatus?.cancel()
        status.text = message
        UIAccessibility.post(notification: .announcement, argument: message)
        guard transient else { return }
        clearStatus = Task { [weak self] in
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            self?.status.text = "Voxlen"
        }
    }
}
