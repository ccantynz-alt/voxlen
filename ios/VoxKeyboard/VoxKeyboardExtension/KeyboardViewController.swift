import UIKit
import AVFoundation

class KeyboardViewController: UIInputViewController, URLSessionWebSocketDelegate {

    // MARK: - UI Elements

    private var keyboardView: UIStackView!
    private var grammarBar: UIView!
    private var grammarLabel: UILabel!
    private var partialLabel: UILabel!
    private var polishButton: UIButton!
    private var micButton: UIButton!
    private let defaults = UserDefaults(suiteName: "group.com.marcoreid.voice")

    // MARK: - State

    private var isShifted = false
    private var isCapsLock = false
    private var isNumberMode = false
    private var isListening = false

    // MARK: - Haptics

    private let haptic = UIImpactFeedbackGenerator(style: .light)
    private let hapticMedium = UIImpactFeedbackGenerator(style: .medium)

    // MARK: - Deepgram STT

    private var webSocketTask: URLSessionWebSocketTask?
    private var webSocketSession: URLSession?
    private let audioEngine = AVAudioEngine()
    private var insertedCharCount = 0
    private var currentUtterance = ""

    // MARK: - Layout

    private var isIPad: Bool { UIDevice.current.userInterfaceIdiom == .pad }
    private var keyFontSize: CGFloat { isIPad ? 26 : 22 }
    private var keySpacing: CGFloat { isIPad ? 6 : 4 }
    private var edgePadding: CGFloat { isIPad ? 12 : 3 }
    private var barHeight: CGFloat { isIPad ? 44 : 36 }
    private var specialKeyWidth: CGFloat { isIPad ? 52 : 36 }
    private var returnKeyWidth: CGFloat { isIPad ? 96 : 72 }
    private var toggleKeyWidth: CGFloat { isIPad ? 60 : 44 }

    private let brandColor = UIColor(red: 0.45, green: 0.27, blue: 0.82, alpha: 1.0)

    // MARK: - Keyboard Layout Data

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

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        haptic.prepare()
        hapticMedium.prepare()
        setupKeyboard()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if isListening { stopDictation() }
    }

    // MARK: - Keyboard Setup

    private func setupKeyboard() {
        view.backgroundColor = .secondarySystemBackground

        // Grammar bar
        grammarBar = UIView()
        grammarBar.backgroundColor = .systemBackground
        grammarBar.translatesAutoresizingMaskIntoConstraints = false

        let separator = UIView()
        separator.backgroundColor = .separator
        separator.translatesAutoresizingMaskIntoConstraints = false
        grammarBar.addSubview(separator)

        grammarLabel = UILabel()
        grammarLabel.text = "Marco Reid Voice"
        grammarLabel.font = .systemFont(ofSize: 12, weight: .medium)
        grammarLabel.textColor = .secondaryLabel
        grammarLabel.translatesAutoresizingMaskIntoConstraints = false

        micButton = UIButton(type: .system)
        micButton.setImage(UIImage(systemName: "mic.fill"), for: .normal)
        micButton.tintColor = brandColor
        micButton.addTarget(self, action: #selector(toggleDictation), for: .touchUpInside)
        micButton.translatesAutoresizingMaskIntoConstraints = false

        polishButton = UIButton(type: .system)
        polishButton.setTitle("Polish", for: .normal)
        polishButton.setImage(UIImage(systemName: "wand.and.stars"), for: .normal)
        polishButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .semibold)
        polishButton.tintColor = brandColor
        polishButton.addTarget(self, action: #selector(polishText), for: .touchUpInside)
        polishButton.translatesAutoresizingMaskIntoConstraints = false

        grammarBar.addSubview(grammarLabel)
        grammarBar.addSubview(micButton)
        grammarBar.addSubview(polishButton)

        // Partial transcript label
        partialLabel = UILabel()
        partialLabel.text = ""
        partialLabel.font = .italicSystemFont(ofSize: 13)
        partialLabel.textColor = .tertiaryLabel
        partialLabel.textAlignment = .center
        partialLabel.alpha = 0
        partialLabel.translatesAutoresizingMaskIntoConstraints = false

        // Keyboard rows
        keyboardView = UIStackView()
        keyboardView.axis = .vertical
        keyboardView.spacing = keySpacing
        keyboardView.distribution = .fillEqually
        keyboardView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(grammarBar)
        view.addSubview(partialLabel)
        view.addSubview(keyboardView)

        NSLayoutConstraint.activate([
            grammarBar.topAnchor.constraint(equalTo: view.topAnchor),
            grammarBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            grammarBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            grammarBar.heightAnchor.constraint(equalToConstant: barHeight),

            separator.leadingAnchor.constraint(equalTo: grammarBar.leadingAnchor),
            separator.trailingAnchor.constraint(equalTo: grammarBar.trailingAnchor),
            separator.bottomAnchor.constraint(equalTo: grammarBar.bottomAnchor),
            separator.heightAnchor.constraint(equalToConstant: 0.5),

            grammarLabel.leadingAnchor.constraint(equalTo: grammarBar.leadingAnchor, constant: 12),
            grammarLabel.centerYAnchor.constraint(equalTo: grammarBar.centerYAnchor),
            micButton.trailingAnchor.constraint(equalTo: polishButton.leadingAnchor, constant: -12),
            micButton.centerYAnchor.constraint(equalTo: grammarBar.centerYAnchor),
            micButton.widthAnchor.constraint(equalToConstant: 32),
            polishButton.trailingAnchor.constraint(equalTo: grammarBar.trailingAnchor, constant: -12),
            polishButton.centerYAnchor.constraint(equalTo: grammarBar.centerYAnchor),

            partialLabel.topAnchor.constraint(equalTo: grammarBar.bottomAnchor, constant: 2),
            partialLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            partialLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            partialLabel.heightAnchor.constraint(equalToConstant: 20),

            keyboardView.topAnchor.constraint(equalTo: partialLabel.bottomAnchor, constant: 2),
            keyboardView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: edgePadding),
            keyboardView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -edgePadding),
            keyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -4),
        ])

        buildKeyboardLayout()
    }

    // MARK: - Build Keyboard Layout

    private func buildKeyboardLayout() {
        keyboardView.arrangedSubviews.forEach { $0.removeFromSuperview() }

        let rows = isNumberMode ? numberRows : letterRows

        for (index, row) in rows.enumerated() {
            let rowStack = UIStackView()
            rowStack.axis = .horizontal
            rowStack.spacing = keySpacing
            rowStack.distribution = .fillEqually

            if index == 2 && !isNumberMode {
                let shiftKey = createSpecialKey(
                    title: nil,
                    image: UIImage(systemName: isShifted || isCapsLock ? "shift.fill" : "shift"),
                    action: #selector(shiftTapped)
                )
                shiftKey.widthAnchor.constraint(equalToConstant: specialKeyWidth).isActive = true
                rowStack.addArrangedSubview(shiftKey)
            }

            for key in row {
                let displayKey = (isShifted || isCapsLock) ? key.uppercased() : key
                let button = createKeyButton(title: displayKey)
                rowStack.addArrangedSubview(button)
            }

            if index == 2 {
                let deleteKey = createSpecialKey(
                    title: nil,
                    image: UIImage(systemName: "delete.left"),
                    action: #selector(deleteTapped)
                )
                deleteKey.widthAnchor.constraint(equalToConstant: specialKeyWidth).isActive = true
                rowStack.addArrangedSubview(deleteKey)
            }

            keyboardView.addArrangedSubview(rowStack)
        }

        // Bottom row
        let bottomRow = UIStackView()
        bottomRow.axis = .horizontal
        bottomRow.spacing = keySpacing
        bottomRow.distribution = .fill

        let numberToggle = createSpecialKey(
            title: isNumberMode ? "ABC" : "123",
            image: nil,
            action: #selector(numberToggleTapped)
        )
        numberToggle.widthAnchor.constraint(equalToConstant: toggleKeyWidth).isActive = true

        let globeKey = createSpecialKey(
            title: nil,
            image: UIImage(systemName: "globe"),
            action: #selector(handleInputModeList(from:with:))
        )
        globeKey.widthAnchor.constraint(equalToConstant: specialKeyWidth).isActive = true

        let spaceKey = createKeyButton(title: "space")
        spaceKey.setTitle("space", for: .normal)
        spaceKey.titleLabel?.font = .systemFont(ofSize: 14)

        let returnKey = createSpecialKey(
            title: "return",
            image: nil,
            action: #selector(returnTapped)
        )
        returnKey.backgroundColor = brandColor
        returnKey.setTitleColor(.white, for: .normal)
        returnKey.widthAnchor.constraint(equalToConstant: returnKeyWidth).isActive = true

        bottomRow.addArrangedSubview(numberToggle)
        bottomRow.addArrangedSubview(globeKey)
        bottomRow.addArrangedSubview(spaceKey)
        bottomRow.addArrangedSubview(returnKey)

        keyboardView.addArrangedSubview(bottomRow)
    }

    // MARK: - Key Button Factories

    private func createKeyButton(title: String) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: keyFontSize, weight: .regular)
        button.setTitleColor(.label, for: .normal)
        button.backgroundColor = .systemBackground
        button.layer.cornerRadius = 5
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 1)
        button.layer.shadowRadius = 0.5
        button.layer.shadowOpacity = 0.2
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
        button.backgroundColor = .tertiarySystemBackground
        button.layer.cornerRadius = 5
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 1)
        button.layer.shadowRadius = 0.5
        button.layer.shadowOpacity = 0.2
        button.addTarget(self, action: action, for: .touchUpInside)
        return button
    }

    // MARK: - Key Actions

    @objc private func keyTapped(_ sender: UIButton) {
        guard let title = sender.titleLabel?.text else { return }
        haptic.impactOccurred()

        // Brief scale pop
        UIView.animate(withDuration: 0.08, animations: {
            sender.transform = CGAffineTransform(scaleX: 1.15, y: 1.15)
        }) { _ in
            UIView.animate(withDuration: 0.08) {
                sender.transform = .identity
            }
        }

        if title == "space" {
            textDocumentProxy.insertText(" ")
        } else {
            textDocumentProxy.insertText(title)
        }

        if isShifted && !isCapsLock {
            isShifted = false
            buildKeyboardLayout()
        }
    }

    @objc private func shiftTapped() {
        hapticMedium.impactOccurred()
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
        hapticMedium.impactOccurred()
        textDocumentProxy.deleteBackward()
    }

    @objc private func returnTapped() {
        haptic.impactOccurred()
        textDocumentProxy.insertText("\n")
    }

    @objc private func numberToggleTapped() {
        haptic.impactOccurred()
        isNumberMode = !isNumberMode
        buildKeyboardLayout()
    }

    // MARK: - Voice Dictation

    @objc private func toggleDictation() {
        hapticMedium.impactOccurred()
        if isListening {
            stopDictation()
        } else {
            startDictation()
        }
    }

    private func startDictation() {
        let engine = defaults?.string(forKey: "sttEngine") ?? "deepgram"
        let deepgramKey = defaults?.string(forKey: "deepgramApiKey") ?? ""

        if engine == "deepgram" && !deepgramKey.isEmpty {
            startDeepgramDictation(apiKey: deepgramKey)
        } else {
            startAppleDictation()
        }
    }

    // MARK: - Deepgram WebSocket STT

    private func startDeepgramDictation(apiKey: String) {
        let lang = defaults?.string(forKey: "language") ?? "en"
        let urlStr = "wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&smart_format=true&language=\(lang)&interim_results=true&endpointing=300&encoding=linear16&sample_rate=16000&channels=1"

        guard let url = URL(string: urlStr) else {
            grammarLabel.text = "Invalid Deepgram URL"
            return
        }

        let config = URLSessionConfiguration.default
        webSocketSession = URLSession(configuration: config, delegate: self, delegateQueue: .main)

        var request = URLRequest(url: url)
        request.setValue("Token \(apiKey)", forHTTPHeaderField: "Authorization")

        webSocketTask = webSocketSession?.webSocketTask(with: request)
        webSocketTask?.resume()

        // Start audio capture
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            grammarLabel.text = "Audio session error"
            return
        }

        let inputNode = audioEngine.inputNode
        let nativeFormat = inputNode.outputFormat(forBus: 0)

        // Convert to 16kHz mono Linear16
        guard let targetFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true) else {
            grammarLabel.text = "Audio format error"
            return
        }

        guard let converter = AVAudioConverter(from: nativeFormat, to: targetFormat) else {
            grammarLabel.text = "Audio converter error"
            return
        }

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: nativeFormat) { [weak self] buffer, _ in
            guard let self = self else { return }

            let frameCount = AVAudioFrameCount(1024)
            guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: frameCount) else { return }

            var error: NSError?
            let status = converter.convert(to: convertedBuffer, error: &error) { _, outStatus in
                outStatus.pointee = .haveData
                return buffer
            }

            guard status != .error, error == nil else { return }

            let audioData = Data(
                bytes: convertedBuffer.int16ChannelData![0],
                count: Int(convertedBuffer.frameLength) * 2
            )

            self.webSocketTask?.send(.data(audioData)) { _ in }
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            grammarLabel.text = "Audio engine failed"
            return
        }

        isListening = true
        insertedCharCount = 0
        currentUtterance = ""
        setMicListeningState(true)
        listenForDeepgramMessages()
    }

    private func listenForDeepgramMessages() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleDeepgramResponse(text)
                default:
                    break
                }
                self.listenForDeepgramMessages()

            case .failure:
                if self.isListening {
                    DispatchQueue.main.async {
                        self.stopDictation()
                    }
                }
            }
        }
    }

    private func handleDeepgramResponse(_ json: String) {
        guard let data = json.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let channel = parsed["channel"] as? [String: Any],
              let alternatives = channel["alternatives"] as? [[String: Any]],
              let first = alternatives.first,
              let transcript = first["transcript"] as? String,
              !transcript.isEmpty else {
            return
        }

        let isFinal = parsed["is_final"] as? Bool ?? false
        let speechFinal = parsed["speech_final"] as? Bool ?? false

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if isFinal {
                // Delete any previously inserted partial text for this utterance
                for _ in 0..<self.insertedCharCount {
                    self.textDocumentProxy.deleteBackward()
                }

                let textToInsert = transcript + " "
                self.textDocumentProxy.insertText(textToInsert)
                self.insertedCharCount = textToInsert.count
                self.currentUtterance += transcript + " "

                // Hide partial label
                UIView.animate(withDuration: 0.15) {
                    self.partialLabel.alpha = 0
                }

                if speechFinal {
                    // Auto-polish the complete utterance
                    let fullUtterance = self.currentUtterance.trimmingCharacters(in: .whitespaces)
                    self.insertedCharCount = 0
                    self.currentUtterance = ""

                    if self.defaults?.bool(forKey: "autoCorrect") == true && !fullUtterance.isEmpty {
                        self.autoPolishUtterance(fullUtterance)
                    }
                }
            } else {
                // Show partial transcript in real-time
                self.partialLabel.text = transcript
                UIView.animate(withDuration: 0.1) {
                    self.partialLabel.alpha = 1
                }
            }
        }
    }

    private func autoPolishUtterance(_ text: String) {
        grammarLabel.text = "Polishing..."
        Task {
            do {
                let corrected = try await correctGrammar(text)
                await MainActor.run {
                    for _ in 0..<(text.count + 1) {
                        self.textDocumentProxy.deleteBackward()
                    }
                    self.textDocumentProxy.insertText(corrected + " ")
                    self.grammarLabel.text = "Marco Reid Voice"
                }
            } catch {
                await MainActor.run {
                    self.grammarLabel.text = "Marco Reid Voice"
                }
            }
        }
    }

    // MARK: - Apple Speech Fallback

    private func startAppleDictation() {
        // Minimal fallback using Apple Speech framework
        // Requires: import Speech (add at top if using this path)
        grammarLabel.text = "Set Deepgram key for best results"

        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            grammarLabel.text = "Audio session error"
            return
        }

        isListening = true
        setMicListeningState(true)

        // For Apple fallback, prompt user to configure Deepgram
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            self?.grammarLabel.text = "Tap Polish to correct grammar"
            self?.stopDictation()
        }
    }

    // MARK: - Stop Dictation

    private func stopDictation() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }

        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        webSocketSession?.invalidateAndCancel()
        webSocketSession = nil

        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        isListening = false
        insertedCharCount = 0
        currentUtterance = ""
        setMicListeningState(false)

        UIView.animate(withDuration: 0.15) {
            self.partialLabel.alpha = 0
        }
    }

    private func setMicListeningState(_ listening: Bool) {
        if listening {
            micButton.tintColor = .systemRed
            micButton.setImage(UIImage(systemName: "mic.slash.fill"), for: .normal)
            grammarLabel.text = "Listening..."

            // Pulse animation
            UIView.animate(withDuration: 0.8, delay: 0, options: [.repeat, .autoreverse, .allowUserInteraction]) {
                self.micButton.transform = CGAffineTransform(scaleX: 1.2, y: 1.2)
            }
        } else {
            micButton.layer.removeAllAnimations()
            micButton.transform = .identity
            micButton.tintColor = brandColor
            micButton.setImage(UIImage(systemName: "mic.fill"), for: .normal)
            grammarLabel.text = "Marco Reid Voice"
        }
    }

    // MARK: - URLSessionWebSocketDelegate

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        // Connected
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        if isListening {
            DispatchQueue.main.async { [weak self] in
                self?.stopDictation()
            }
        }
    }

    // MARK: - Grammar Correction (Polish)

    @objc private func polishText() {
        guard let text = textDocumentProxy.documentContextBeforeInput,
              !text.isEmpty else { return }

        hapticMedium.impactOccurred()
        grammarLabel.text = "Polishing..."
        polishButton.isEnabled = false

        let textToPolish = extractLastSentence(from: text)

        Task {
            do {
                let corrected = try await correctGrammar(textToPolish)
                await MainActor.run {
                    for _ in 0..<textToPolish.count {
                        textDocumentProxy.deleteBackward()
                    }
                    textDocumentProxy.insertText(corrected)

                    grammarLabel.text = "Polished!"
                    polishButton.isEnabled = true

                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                        self?.grammarLabel.text = "Marco Reid Voice"
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
        let sentenceEnders: [Character] = [".", "!", "?", "\n"]
        if let lastEnder = text.dropLast().lastIndex(where: { sentenceEnders.contains($0) }) {
            let startIndex = text.index(after: lastEnder)
            return String(text[startIndex...]).trimmingCharacters(in: .whitespaces)
        }
        return text
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

// MARK: - Errors

enum GrammarError: Error {
    case noApiKey
    case apiError
}
