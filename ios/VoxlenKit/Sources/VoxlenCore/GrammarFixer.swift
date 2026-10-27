import Foundation

public enum FixError: Error, Equatable, Sendable {
    case notConfigured
    case unauthorized
    case planRequired
    case tooLong
    case refused
    case rateLimited
    case timedOut
    case offline
    case server(Int)
    case invalidResponse

    /// Short enough for the keyboard's status bar.
    public var message: String {
        switch self {
        case .notConfigured: "Sign in to Voxlen, or add an API key, in the Voxlen app"
        case .unauthorized: "Sign in again in the Voxlen app"
        case .planRequired: "Your Voxlen plan has ended — renew in the app"
        case .tooLong: "Too much text — select a shorter passage"
        case .refused: "This text couldn't be checked"
        case .rateLimited: "Busy — try again in a moment"
        case .timedOut: "No response — try again"
        case .offline: "You're offline"
        case .server: "Grammar service error — try again"
        case .invalidResponse: "Unexpected response — try again"
        }
    }
}

public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

public struct URLSessionTransport: HTTPTransport {
    let session: URLSession

    public init(session: URLSession = URLSessionTransport.makeSession()) {
        self.session = session
    }

    /// A keyboard waits on this call: fail fast rather than hang for a minute.
    public static func makeSession(timeout: TimeInterval = 15) -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = timeout
        config.waitsForConnectivity = false
        return URLSession(configuration: config)
    }

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw FixError.invalidResponse }
            return (data, http)
        } catch let error as URLError {
            switch error.code {
            case .timedOut: throw FixError.timedOut
            case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed, .internationalRoamingOff:
                throw FixError.offline
            default: throw FixError.server(error.errorCode)
            }
        }
    }
}

/// Proofreads text and returns the edits that pass local validation.
public protocol GrammarFixing: Sendable {
    func fix(_ text: String, locale: FixLocale, protectedTerms: [String]) async throws -> EditCheck
}

extension GrammarFixing {
    func validated(_ edits: [ProposedEdit], text: String, protectedTerms: [String]) -> EditCheck {
        EditValidator.check(text: text, edits: edits, protectedTerms: protectedTerms)
    }

    func checkLength(_ text: String) throws {
        if text.utf16.count > FixPrompt.maxTextCharacters { throw FixError.tooLong }
    }
}

/// The account route: voxlen.ai holds the provider key and chooses the model.
public struct VoxlenAccountFixer: GrammarFixing {
    public static let productionEndpoint = URL(string: "https://www.voxlen.ai/api/grammar-fix")!

    let endpoint: URL
    let accountToken: String
    let transport: any HTTPTransport

    public init(accountToken: String, endpoint: URL = productionEndpoint, transport: any HTTPTransport = URLSessionTransport()) {
        self.accountToken = accountToken
        self.endpoint = endpoint
        self.transport = transport
    }

    struct Response: Decodable {
        let edits: [ProposedEdit]
    }

    public func fix(_ text: String, locale: FixLocale, protectedTerms: [String]) async throws -> EditCheck {
        try checkLength(text)
        let terms = FixPrompt.normalizeProtectedTerms(protectedTerms)
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accountToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "text": text,
            "locale": locale.rawValue,
            "protected_terms": terms,
        ])

        let (data, http) = try await transport.send(request)
        switch http.statusCode {
        case 200: break
        case 401: throw FixError.unauthorized
        case 402: throw FixError.planRequired
        case 413: throw FixError.tooLong
        case 422: throw FixError.refused
        case 429: throw FixError.rateLimited
        default: throw FixError.server(http.statusCode)
        }
        guard let body = try? JSONDecoder().decode(Response.self, from: data) else { throw FixError.invalidResponse }
        return validated(body.edits, text: text, protectedTerms: terms)
    }
}

/// The BYOK route: the user's own Anthropic key, straight to the Messages API.
/// Swift has no official Anthropic SDK, so this is a plain HTTP request.
public struct AnthropicFixer: GrammarFixing {
    public static let defaultModel = "claude-opus-5-5"
    static let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!

    let apiKey: String
    let model: String
    let transport: any HTTPTransport

    public init(apiKey: String, model: String = AnthropicFixer.defaultModel, transport: any HTTPTransport = URLSessionTransport()) {
        self.apiKey = apiKey
        self.model = model
        self.transport = transport
    }

    /// Haiku has no server-side fallback model, so the parameter is left off.
    var usesFallbacks: Bool { !model.hasPrefix("claude-haiku") }

    func makeRequest(text: String, locale: FixLocale, protectedTerms: [String]) throws -> URLRequest {
        var request = URLRequest(url: Self.endpoint)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        var body: [String: Any] = [
            "model": model,
            "max_tokens": 4096,
            "system": FixPrompt.system,
            "messages": [["role": "user", "content": FixPrompt.userMessage(text: text, locale: locale, protectedTerms: protectedTerms)]],
            "output_config": [
                "effort": "low",
                "format": ["type": "json_schema", "schema": FixPrompt.outputSchema],
            ],
        ]
        if usesFallbacks {
            request.setValue("server-side-fallback-2026-07-01", forHTTPHeaderField: "anthropic-beta")
            body["fallbacks"] = "default"
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return request
    }

    struct MessageResponse: Decodable {
        struct Block: Decodable {
            let type: String
            let text: String?
        }
        let content: [Block]
        let stop_reason: String?
    }

    struct Output: Decodable {
        let edits: [ProposedEdit]
    }

    public func fix(_ text: String, locale: FixLocale, protectedTerms: [String]) async throws -> EditCheck {
        try checkLength(text)
        let terms = FixPrompt.normalizeProtectedTerms(protectedTerms)
        let (data, http) = try await transport.send(makeRequest(text: text, locale: locale, protectedTerms: terms))
        switch http.statusCode {
        case 200: break
        case 401, 403: throw FixError.unauthorized
        case 413: throw FixError.tooLong
        case 429, 529: throw FixError.rateLimited
        default: throw FixError.server(http.statusCode)
        }
        guard let message = try? JSONDecoder().decode(MessageResponse.self, from: data) else {
            throw FixError.invalidResponse
        }
        // Check the stop reason before reading content: a refusal has none.
        if message.stop_reason == "refusal" { throw FixError.refused }
        guard let json = message.content.first(where: { $0.type == "text" })?.text,
              let output = try? JSONDecoder().decode(Output.self, from: Data(json.utf8)) else {
            throw FixError.invalidResponse
        }
        return validated(output.edits, text: text, protectedTerms: terms)
    }
}
