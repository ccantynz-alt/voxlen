import UIKit
import VoxlenCore
import VoxlenSecrets

/// The Voxlen keyboard: native-feeling typing that works without Full
/// Access (App Review 4.4.1), plus a Fix button that proofreads the
/// selection or the sentence before the cursor and applies only validated
/// edits, with Undo.
final class KeyboardViewController: UIInputViewController {
    private let fixBar = FixBar()
    private let keys = KeyboardView()
    private let settings = SharedSettings()
    private var heightConstraint: NSLayoutConstraint?

    private var fixTask: Task<Void, Never>?
    private var pendingUndo: UndoPlan?
    /// A large change waiting for the user to tap Apply.
    private var pendingReview: (target: FixTarget, plan: ReplacementPlan, count: Int)?

    private lazy var haptics = UIImpactFeedbackGenerator(style: .light)

    // MARK: Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        let stack = UIStackView(arrangedSubviews: [fixBar, keys])
        stack.axis = .vertical
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        keys.delegate = self
        keys.globeButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)

        fixBar.fixButton.addTarget(self, action: #selector(fixTapped), for: .touchUpInside)
        fixBar.undoButton.addTarget(self, action: #selector(undoTapped), for: .touchUpInside)
        fixBar.applyButton.addTarget(self, action: #selector(applyTapped), for: .touchUpInside)

        if let inputView = inputView as? UIInputView {
            inputView.allowsSelfSizing = true
        }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        // Needs Full Access to land; when it does, the app knows both facts.
        settings.recordKeyboardHeartbeat(hasFullAccess: hasFullAccess)
        if hasFullAccess { haptics.prepare() }
        refreshForDocument()
    }

    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        keys.showsGlobe = needsInputModeSwitchKey
        let height = 44 + keys.rowHeight * 4 + 8
        if let heightConstraint {
            heightConstraint.constant = height
        } else {
            let c = view.heightAnchor.constraint(equalToConstant: height)
            c.priority = .defaultHigh
            c.isActive = true
            heightConstraint = c
        }
    }

    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        refreshForDocument()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        fixTask?.cancel()
        fixTask = nil
        fixBar.isWorking = false
    }

    // MARK: Document state

    private func refreshForDocument() {
        let proxy = textDocumentProxy
        view.overrideUserInterfaceStyle = switch proxy.keyboardAppearance ?? .default {
        case .dark: .dark
        case .light: .light
        default: .unspecified
        }
        let (title, primary) = Self.returnKey(for: proxy.returnKeyType)
        keys.returnTitle = title
        keys.returnIsPrimary = primary
        updateAutoShift()
    }

    static func returnKey(for type: UIReturnKeyType?) -> (String, Bool) {
        switch type ?? .default {
        case .go: ("go", true)
        case .google, .yahoo, .search: ("search", true)
        case .join: ("join", true)
        case .next: ("next", false)
        case .route: ("route", true)
        case .send: ("send", true)
        case .done: ("done", true)
        case .emergencyCall: ("call", true)
        case .continue: ("continue", true)
        default: ("return", false)
        }
    }

    private var autoCapitalization: AutoCapitalization {
        switch textDocumentProxy.autocapitalizationType ?? .sentences {
        case .none: .none
        case .words: .words
        case .allCharacters: .allCharacters
        default: .sentences
        }
    }

    private func updateAutoShift() {
        guard keys.shiftState != .locked else { return }
        let before = textDocumentProxy.documentContextBeforeInput
        keys.shiftState = keys.page == .letters && TypingRules.shouldCapitalize(before: before, mode: autoCapitalization) ? .on : .off
    }

    private func feedback() {
        UIDevice.current.playInputClick()
        if hasFullAccess { haptics.impactOccurred() }
    }

    // MARK: Fix

    private func makeFixer() -> (any GrammarFixing)? {
        switch settings.route {
        case .account:
            guard let token = Keychain.read(.voxlenAccountToken) else { return nil }
            return VoxlenAccountFixer(accountToken: token)
        case .anthropicKey:
            guard let key = Keychain.read(.anthropicAPIKey) else { return nil }
            return AnthropicFixer(apiKey: key, model: settings.anthropicModel)
        }
    }

    @objc private func fixTapped() {
        feedback()
        guard hasFullAccess else {
            fixBar.show("Turn on Allow Full Access in Settings › Voxlen › Keyboards", transient: false)
            return
        }
        let proxy = textDocumentProxy
        guard let target = TextTargeting.target(before: proxy.documentContextBeforeInput, selected: proxy.selectedText) else {
            fixBar.show("Nothing to fix here")
            return
        }
        guard let fixer = makeFixer() else {
            fixBar.show(FixError.notConfigured.message, transient: false)
            return
        }

        clearPending()
        fixBar.isWorking = true
        fixBar.show("Checking…", transient: false)
        let locale = settings.locale
        let terms = settings.protectedTerms
        fixTask?.cancel()
        fixTask = Task { [weak self] in
            do {
                let check = try await fixer.fix(target.text, locale: locale, protectedTerms: terms)
                guard !Task.isCancelled else { return }
                self?.finishFix(check, target: target)
            } catch {
                guard !Task.isCancelled, let self else { return }
                self.fixBar.isWorking = false
                self.fixBar.show((error as? FixError)?.message ?? FixError.invalidResponse.message)
            }
        }
    }

    private func finishFix(_ check: EditCheck, target: FixTarget) {
        fixBar.isWorking = false
        guard let plan = TextTargeting.plan(for: target, corrected: check.corrected) else {
            fixBar.show("Looks good — no errors found")
            return
        }
        if check.rewriteSuspected {
            // Not what Fix is for: show it and let the user decide.
            pendingReview = (target, plan, check.accepted.count)
            fixBar.applyButton.isHidden = false
            fixBar.show("Large change suggested — tap Apply to accept", transient: false)
            return
        }
        apply(plan, target: target, count: check.accepted.count)
    }

    private func apply(_ plan: ReplacementPlan, target: FixTarget, count: Int) {
        let proxy = textDocumentProxy
        let stillThere: Bool = if plan.replacesSelection {
            proxy.selectedText == target.text
        } else {
            proxy.documentContextBeforeInput?.hasSuffix(plan.requiredSuffix) ?? false
        }
        guard stillThere else {
            fixBar.show("The text changed — tap Fix again")
            return
        }
        if plan.replacesSelection {
            proxy.insertText(plan.insert)
        } else {
            for _ in 0..<plan.deleteCount { proxy.deleteBackward() }
            proxy.insertText(plan.insert)
        }
        pendingUndo = plan.undo
        fixBar.undoButton.isHidden = false
        fixBar.show(count == 1 ? "Fixed 1 error" : "Fixed \(count) errors")
    }

    @objc private func applyTapped() {
        feedback()
        guard let review = pendingReview else { return }
        clearPending()
        apply(review.plan, target: review.target, count: review.count)
    }

    @objc private func undoTapped() {
        feedback()
        guard let undo = pendingUndo else { return }
        clearPending()
        let proxy = textDocumentProxy
        guard proxy.documentContextBeforeInput?.hasSuffix(undo.requiredSuffix) ?? false else {
            fixBar.show("The text changed — nothing to undo")
            return
        }
        for _ in 0..<undo.deleteCount { proxy.deleteBackward() }
        proxy.insertText(undo.insert)
        fixBar.show("Undone")
    }

    private func clearPending() {
        pendingUndo = nil
        pendingReview = nil
        fixBar.undoButton.isHidden = true
        fixBar.applyButton.isHidden = true
    }
}

// MARK: - Typing

extension KeyboardViewController: KeyboardViewDelegate {
    func keyboardView(_ view: KeyboardView, didTap key: KeyKind) {
        feedback()
        let proxy = textDocumentProxy
        // Typing makes an earlier Undo unsafe to offer.
        if pendingUndo != nil || pendingReview != nil { clearPending() }

        switch key {
        case .character(let c):
            proxy.insertText(keys.shiftState == .off || keys.page != .letters ? c : c.uppercased())
            if keys.page != .letters, c == "'" { keys.page = .letters }
        case .space:
            if TypingRules.doubleSpaceMakesPeriod(before: proxy.documentContextBeforeInput) {
                proxy.deleteBackward()
                proxy.insertText(". ")
            } else {
                proxy.insertText(" ")
            }
            if keys.page != .letters { keys.page = .letters }
        case .returnKey:
            proxy.insertText("\n")
        case .shift:
            keys.shiftState = keys.shiftState == .off ? .on : .off
            return
        case .page(let page):
            keys.page = page
        case .delete, .globe:
            return
        }
        updateAutoShift()
    }

    func keyboardViewDidDoubleTapShift(_ view: KeyboardView) {
        feedback()
        keys.shiftState = .locked
    }

    func keyboardViewDidRepeatDelete(_ view: KeyboardView) {
        feedback()
        if pendingUndo != nil || pendingReview != nil { clearPending() }
        textDocumentProxy.deleteBackward()
        updateAutoShift()
    }
}
