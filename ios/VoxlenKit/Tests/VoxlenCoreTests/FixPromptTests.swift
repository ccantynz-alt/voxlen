import XCTest
@testable import VoxlenCore

final class FixPromptTests: XCTestCase {
    struct Shared: Decodable {
        struct Example: Decodable {
            let text: String
            let locale: String
            let protectedTerms: [String]
            let expected: String
        }
        let version: String
        let system: [String]
        let userMessageExample: Example
    }

    func testMatchesTheServerPrompt() throws {
        let shared = try JSONDecoder().decode(Shared.self, from: SharedFixtures.data("shared/grammar-fix/prompt.json"))
        XCTAssertEqual(FixPrompt.version, shared.version)
        XCTAssertEqual(FixPrompt.system, shared.system.joined(separator: "\n"))
        let ex = shared.userMessageExample
        let locale = try XCTUnwrap(FixLocale(rawValue: ex.locale))
        XCTAssertEqual(FixPrompt.userMessage(text: ex.text, locale: locale, protectedTerms: ex.protectedTerms), ex.expected)
    }

    func testNoProtectedTerms() {
        XCTAssertTrue(FixPrompt.userMessage(text: "Hi", locale: .enUS, protectedTerms: []).contains("Protected terms: (none)"))
    }

    func testNormalizeProtectedTerms() {
        XCTAssertEqual(
            FixPrompt.normalizeProtectedTerms(["  Smith v Jones ", "Smith v Jones", "a\nb", ""]),
            ["Smith v Jones", "a b"]
        )
        XCTAssertEqual(FixPrompt.normalizeProtectedTerms([String(repeating: "x", count: 81)]), [])
        XCTAssertEqual(FixPrompt.normalizeProtectedTerms((0..<150).map { "t\($0)" }).count, 100)
    }

    func testLocaleMatchesRegion() {
        XCTAssertEqual(FixLocale.matching(Locale(identifier: "en_NZ")), .enNZ)
        XCTAssertEqual(FixLocale.matching(Locale(identifier: "fr_FR")), .enUS)
    }
}
