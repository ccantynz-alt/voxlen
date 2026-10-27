import XCTest
@testable import VoxlenCore

/// Answers every request with a fixed response and records what was sent.
final class StubTransport: HTTPTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var _requests: [URLRequest] = []
    let status: Int
    let body: Data

    init(status: Int = 200, json: Any) {
        self.status = status
        self.body = try! JSONSerialization.data(withJSONObject: json)
    }

    var requests: [URLRequest] { lock.withLock { _requests } }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        lock.withLock { _requests.append(request) }
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        return (body, response)
    }
}

final class GrammarFixerTests: XCTestCase {
    func body(_ request: URLRequest) throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(request.httpBody)) as? [String: Any])
    }

    // MARK: Account route

    func testAccountSendsTextLocaleAndTermsAndRevalidates() async throws {
        let transport = StubTransport(json: ["edits": [
            ["original": "She go", "replacement": "She goes"],
            ["original": "not in the text", "replacement": "x"],
        ]])
        let fixer = VoxlenAccountFixer(accountToken: "tok", transport: transport)
        let check = try await fixer.fix("She go to court.", locale: .enNZ, protectedTerms: [" Acme ", "Acme"])

        XCTAssertEqual(check.corrected, "She goes to court.")
        XCTAssertEqual(check.rejected.map(\.reason), [.notFound])

        let request = try XCTUnwrap(transport.requests.first)
        XCTAssertEqual(request.url, VoxlenAccountFixer.productionEndpoint)
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer tok")
        let sent = try body(request)
        XCTAssertEqual(sent["locale"] as? String, "en-NZ")
        XCTAssertEqual(sent["protected_terms"] as? [String], ["Acme"])
    }

    func testAccountStatusMapping() async {
        let cases: [(Int, FixError)] = [(401, .unauthorized), (402, .planRequired), (413, .tooLong), (422, .refused), (429, .rateLimited), (500, .server(500))]
        for (status, expected) in cases {
            let fixer = VoxlenAccountFixer(accountToken: "t", transport: StubTransport(status: status, json: [:]))
            do {
                _ = try await fixer.fix("x", locale: .enUS, protectedTerms: [])
                XCTFail("status \(status) should throw")
            } catch {
                XCTAssertEqual(error as? FixError, expected, "status \(status)")
            }
        }
    }

    func testTooLongNeverLeavesTheDevice() async {
        let transport = StubTransport(json: [:])
        let fixer = VoxlenAccountFixer(accountToken: "t", transport: transport)
        do {
            _ = try await fixer.fix(String(repeating: "a", count: FixPrompt.maxTextCharacters + 1), locale: .enUS, protectedTerms: [])
            XCTFail("should throw")
        } catch {
            XCTAssertEqual(error as? FixError, .tooLong)
        }
        XCTAssertTrue(transport.requests.isEmpty)
    }

    // MARK: BYOK route

    func anthropicReply(_ edits: [[String: String]], stopReason: String = "end_turn") throws -> [String: Any] {
        let json = String(decoding: try JSONSerialization.data(withJSONObject: ["edits": edits]), as: UTF8.self)
        return ["content": [["type": "thinking", "thinking": ""], ["type": "text", "text": json]], "stop_reason": stopReason]
    }

    func testAnthropicRequestShape() async throws {
        let transport = StubTransport(json: try anthropicReply([["original": "tomorow", "replacement": "tomorrow", "category": "spelling", "reason": "typo"]]))
        let fixer = AnthropicFixer(apiKey: "sk-test", transport: transport)
        let check = try await fixer.fix("File it tomorow.", locale: .enGB, protectedTerms: [])
        XCTAssertEqual(check.corrected, "File it tomorrow.")

        let request = try XCTUnwrap(transport.requests.first)
        XCTAssertEqual(request.value(forHTTPHeaderField: "x-api-key"), "sk-test")
        XCTAssertEqual(request.value(forHTTPHeaderField: "anthropic-beta"), "server-side-fallback-2026-07-01")
        let sent = try body(request)
        XCTAssertEqual(sent["model"] as? String, AnthropicFixer.defaultModel)
        XCTAssertEqual(sent["system"] as? String, FixPrompt.system)
        XCTAssertEqual(sent["fallbacks"] as? String, "default")
        let output = try XCTUnwrap(sent["output_config"] as? [String: Any])
        XCTAssertEqual(output["effort"] as? String, "low")
        XCTAssertEqual((output["format"] as? [String: Any])?["type"] as? String, "json_schema")
        XCTAssertNil(sent["temperature"])
    }

    func testHaikuSendsNoFallbacks() throws {
        let request = try AnthropicFixer(apiKey: "k", model: "claude-haiku-5-5", transport: StubTransport(json: [:]))
            .makeRequest(text: "x", locale: .enUS, protectedTerms: [])
        XCTAssertNil(request.value(forHTTPHeaderField: "anthropic-beta"))
        XCTAssertNil(try body(request)["fallbacks"])
    }

    func testAnthropicRefusalIsCheckedBeforeContent() async throws {
        let fixer = AnthropicFixer(apiKey: "k", transport: StubTransport(json: ["content": [], "stop_reason": "refusal"]))
        do {
            _ = try await fixer.fix("x", locale: .enUS, protectedTerms: [])
            XCTFail("should throw")
        } catch {
            XCTAssertEqual(error as? FixError, .refused)
        }
    }

    func testAnthropicMalformedOutput() async throws {
        let reply: [String: Any] = ["content": [["type": "text", "text": "not json"]], "stop_reason": "end_turn"]
        let fixer = AnthropicFixer(apiKey: "k", transport: StubTransport(json: reply))
        do {
            _ = try await fixer.fix("x", locale: .enUS, protectedTerms: [])
            XCTFail("should throw")
        } catch {
            XCTAssertEqual(error as? FixError, .invalidResponse)
        }
    }
}
