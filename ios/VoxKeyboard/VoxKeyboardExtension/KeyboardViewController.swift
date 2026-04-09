import UIKit

class KeyboardViewController: UIInputViewController {

    private var keyboardView: UIStackView!
    private var grammarBar: UIView!
    private var grammarLabel: UILabel!
    private var polishButton: UIButton!
    private let defaults = UserDefaults(suiteName: "group.com.vox.keyboard")

    // Current state
    private var isShifted = false
    private var isCapsLock = false
    private var isNumberMode = false

    // Standard QWERTY layout
    private let letterRows: [[String]] = [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["z", "x", "c", "v", "b", "n", "m"]
    ]

    private let numberRows: [[String]] = [
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
        ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""],
        [".", ",", "?", "!", "'"]
    ]

    override func viewDidLoad() {
        super.viewDidLoad()
        setupKeyboard()
    }

    private func setupKeyboard() {
        view.backgroundColor = UIColor(red: 0.82, green: 0.84, blue: 0.86, alpha: 1.0)

        // Grammar suggestion bar
        grammarBar = UIView()
        grammarBar.backgroundColor = UIColor.systemBackground
        grammarBar.translatesAutoresizingMaskIntoConstraints = false

        grammarLabel = UILabel()
        grammarLabel.text = "Vox AI Grammar"
        grammarLabel.font = .systemFont(ofSize: 12, weight: .medium)
        grammarLabel.textColor = .secondaryLabel
        grammarLabel.translatesAutoresizingMaskIntoConstraints = false

        polishButton = UIButton(type: .system)
        polishButton.setTitle("Polish", for: .normal)
        polishButton.setImage(UIImage(systemName: "wand.and.stars"), for: .normal)
        polishButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .semibold)
        polishButton.tintColor = UIColor(red: 0.2, green: 0.4, blue: 1.0, alpha: 1.0)
        polishButton.addTarget(self, action: #selector(polishText), for: .touchUpInside)
        polishButton.translatesAutoresizingMaskIntoConstraints = false

        grammarBar.addSubview(grammarLabel)
        grammarBar.addSubview(polishButton)

        NSLayoutConstraint.activate([
            grammarLabel.leadingAnchor.constraint(equalTo: grammarBar.leadingAnchor, constant: 12),
            grammarLabel.centerYAnchor.constraint(equalTo: grammarBar.centerYAnchor),
            polishButton.trailingAnchor.constraint(equalTo: grammarBar.trailingAnchor, constant: -12),
            polishButton.centerYAnchor.constraint(equalTo: grammarBar.centerYAnchor),
        ])

        // Keyboard rows
        keyboardView = UIStackView()
        keyboardView.axis = .vertical
        keyboardView.spacing = 6
        keyboardView.distribution = .fillEqually
        keyboardView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(grammarBar)
        view.addSubview(keyboardView)

        NSLayoutConstraint.activate([
            grammarBar.topAnchor.constraint(equalTo: view.topAnchor),
            grammarBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            grammarBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            grammarBar.heightAnchor.constraint(equalToConstant: 36),

            keyboardView.topAnchor.constraint(equalTo: grammarBar.bottomAnchor, constant: 4),
            keyboardView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 3),
            keyboardView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -3),
            keyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -4),
        ])

        buildKeyboardLayout()
    }

    private func buildKeyboardLayout() {
        keyboardView.arrangedSubviews.forEach { $0.removeFromSuperview() }

        let rows = isNumberMode ? numberRows : letterRows

        for (index, row) in rows.enumerated() {
            let rowStack = UIStackView()
            rowStack.axis = .horizontal
            rowStack.spacing = 4
            rowStack.distribution = .fillEqually

            // Add shift key on the left of last letter row
            if index == 2 && !isNumberMode {
                let shiftKey = createSpecialKey(
                    title: nil,
                    image: UIImage(systemName: isShifted || isCapsLock ? "shift.fill" : "shift"),
                    action: #selector(shiftTapped)
                )
                shiftKey.widthAnchor.constraint(equalToConstant: 36).isActive = true
                rowStack.addArrangedSubview(shiftKey)
            }

            for key in row {
                let displayKey = (isShifted || isCapsLock) ? key.uppercased() : key
                let button = createKeyButton(title: displayKey)
                rowStack.addArrangedSubview(button)
            }

            // Add backspace on the right of last row
            if index == 2 {
                let deleteKey = createSpecialKey(
                    title: nil,
                    image: UIImage(systemName: "delete.left"),
                    action: #selector(deleteTapped)
                )
                deleteKey.widthAnchor.constraint(equalToConstant: 36).isActive = true
                rowStack.addArrangedSubview(deleteKey)
            }

            keyboardView.addArrangedSubview(rowStack)
        }

        // Bottom row: number toggle, globe, space, return
        let bottomRow = UIStackView()
        bottomRow.axis = .horizontal
        bottomRow.spacing = 4
        bottomRow.distribution = .fill

        let numberToggle = createSpecialKey(
            title: isNumberMode ? "ABC" : "123",
            image: nil,
            action: #selector(numberToggleTapped)
        )
        numberToggle.widthAnchor.constraint(equalToConstant: 44).isActive = true

        let globeKey = createSpecialKey(
            title: nil,
            image: UIImage(systemName: "globe"),
            action: #selector(handleInputModeList(from:with:))
        )
        globeKey.widthAnchor.constraint(equalToConstant: 36).isActive = true

        let spaceKey = createKeyButton(title: "space")
        spaceKey.setTitle("space", for: .normal)
        spaceKey.titleLabel?.font = .systemFont(ofSize: 14)

        let returnKey = createSpecialKey(
            title: "return",
            image: nil,
            action: #selector(returnTapped)
        )
        returnKey.backgroundColor = UIColor(red: 0.2, green: 0.4, blue: 1.0, alpha: 1.0)
        returnKey.setTitleColor(.white, for: .normal)
        returnKey.widthAnchor.constraint(equalToConstant: 72).isActive = true

        bottomRow.addArrangedSubview(numberToggle)
        bottomRow.addArrangedSubview(globeKey)
        bottomRow.addArrangedSubview(spaceKey)
        bottomRow.addArrangedSubview(returnKey)

        keyboardView.addArrangedSubview(bottomRow)
    }

    private func createKeyButton(title: String) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 22, weight: .regular)
        button.setTitleColor(.label, for: .normal)
        button.backgroundColor = .white
        button.layer.cornerRadius = 5
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 1)
        button.layer.shadowRadius = 0.5
        button.layer.shadowOpacity = 0.25
        button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
        return button
    }

    private func createSpecialKey(title: String?, image: UIImage?, action: Selector) -> UIButton {
        let button = UIButton(type: .system)
        if let title = title {
            button.setTitle(title, for: .normal)
            button.titleLabel?.font = .systemFont(ofSize: 14, weight: .medium)
        }
        if let image = image {
            button.setImage(image, for: .normal)
        }
        button.tintColor = .label
        button.backgroundColor = UIColor(white: 0.68, alpha: 1.0)
        button.layer.cornerRadius = 5
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 1)
        button.layer.shadowRadius = 0.5
        button.layer.shadowOpacity = 0.25
        button.addTarget(self, action: action, for: .touchUpInside)
        return button
    }

    // MARK: - Key Actions

    @objc private func keyTapped(_ sender: UIButton) {
        guard let title = sender.titleLabel?.text else { return }

        if title == "space" {
            textDocumentProxy.insertText(" ")

            // Auto-correct after space if enabled
            if defaults?.bool(forKey: "autoCorrect") == true {
                checkAndCorrectLastWord()
            }
        } else {
            textDocumentProxy.insertText(title)
        }

        // Turn off shift after one key press (unless caps lock)
        if isShifted && !isCapsLock {
            isShifted = false
            buildKeyboardLayout()
        }
    }

    @objc private func shiftTapped() {
        if isShifted {
            if isCapsLock {
                isCapsLock = false
                isShifted = false
            } else {
                isCapsLock = true
            }
        } else {
            isShifted = true
        }
        buildKeyboardLayout()
    }

    @objc private func deleteTapped() {
        textDocumentProxy.deleteBackward()
    }

    @objc private func returnTapped() {
        textDocumentProxy.insertText("\n")
    }

    @objc private func numberToggleTapped() {
        isNumberMode = !isNumberMode
        buildKeyboardLayout()
    }

    @objc private func polishText() {
        // Get the current text from the text field
        guard let text = textDocumentProxy.documentContextBeforeInput,
              !text.isEmpty else { return }

        grammarLabel.text = "Polishing..."
        polishButton.isEnabled = false

        // Find the last sentence or paragraph to polish
        let textToPolish = extractLastSentence(from: text)

        Task {
            do {
                let corrected = try await correctGrammar(textToPolish)

                await MainActor.run {
                    // Delete the original text
                    for _ in 0..<textToPolish.count {
                        textDocumentProxy.deleteBackward()
                    }
                    // Insert corrected text
                    textDocumentProxy.insertText(corrected)

                    grammarLabel.text = "Polished!"
                    polishButton.isEnabled = true

                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                        self?.grammarLabel.text = "Vox AI Grammar"
                    }
                }
            } catch {
                await MainActor.run {
                    grammarLabel.text = "Error - check API key"
                    polishButton.isEnabled = true
                }
            }
        }
    }

    private func extractLastSentence(from text: String) -> String {
        // Find the last sentence boundary
        let sentenceEnders: [Character] = [".", "!", "?", "\n"]
        if let lastEnder = text.dropLast().lastIndex(where: { sentenceEnders.contains($0) }) {
            let startIndex = text.index(after: lastEnder)
            return String(text[startIndex...]).trimmingCharacters(in: .whitespaces)
        }
        return text
    }

    private func checkAndCorrectLastWord() {
        // Lightweight auto-correction for the last word
        // Full grammar correction uses the Polish button
    }

    // MARK: - AI Grammar Correction

    private func correctGrammar(_ text: String) async throws -> String {
        let provider = defaults?.string(forKey: "aiProvider") ?? "claude"
        let apiKey = defaults?.string(forKey: "apiKey") ?? ""
        let style = defaults?.string(forKey: "writingStyle") ?? "professional"

        guard !apiKey.isEmpty else {
            throw GrammarError.noApiKey
        }

        if provider == "claude" {
            return try await correctWithClaude(text: text, apiKey: apiKey, style: style)
        } else {
            return try await correctWithOpenAI(text: text, apiKey: apiKey, style: style)
        }
    }

    private func correctWithClaude(text: String, apiKey: String, style: String) async throws -> String {
        let url = URL(string: "https://api.anthropic.com/v1/messages")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "content-type")

        let prompt = """
        Fix grammar, spelling, and punctuation in this text. Make it \(style). \
        Return ONLY the corrected text, nothing else: "\(text)"
        """

        let body: [String: Any] = [
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1024,
            "messages": [["role": "user", "content": prompt]]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw GrammarError.apiError
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let content = (json?["content"] as? [[String: Any]])?.first
        let corrected = content?["text"] as? String ?? text

        // Remove quotes if the model wrapped the response
        return corrected
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "\""))
    }

    private func correctWithOpenAI(text: String, apiKey: String, style: String) async throws -> String {
        let url = URL(string: "https://api.openai.com/v1/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let prompt = """
        Fix grammar, spelling, and punctuation. Make it \(style). \
        Return ONLY the corrected text: "\(text)"
        """

        let body: [String: Any] = [
            "model": "gpt-4o-mini",
            "messages": [["role": "user", "content": prompt]],
            "temperature": 0.1
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw GrammarError.apiError
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let choices = json?["choices"] as? [[String: Any]]
        let message = choices?.first?["message"] as? [String: Any]
        let corrected = message?["content"] as? String ?? text

        return corrected
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "\""))
    }
}

enum GrammarError: Error {
    case noApiKey
    case apiError
}
