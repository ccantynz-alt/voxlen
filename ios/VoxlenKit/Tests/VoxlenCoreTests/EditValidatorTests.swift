import XCTest
@testable import VoxlenCore

final class EditValidatorTests: XCTestCase {
    struct Case: Decodable {
        let name: String
        let text: String
        let edits: [ProposedEdit]
        let protectedTerms: [String]
        let accepted: [String]
        let rejected: [String: String]
        let corrected: String
    }

    struct Fixture: Decodable {
        let cases: [Case]
    }

    func testSharedCases() throws {
        let fixture = try JSONDecoder().decode(Fixture.self, from: SharedFixtures.data("shared/grammar-fix/edit-cases.json"))
        XCTAssertGreaterThan(fixture.cases.count, 5)
        for c in fixture.cases {
            let result = EditValidator.check(text: c.text, edits: c.edits, protectedTerms: c.protectedTerms)
            XCTAssertEqual(result.accepted.map(\.edit.original), c.accepted, c.name)
            let rejected = Dictionary(result.rejected.map { ($0.edit.original, $0.reason.rawValue) }, uniquingKeysWith: { a, _ in a })
            XCTAssertEqual(rejected, c.rejected, c.name)
            XCTAssertEqual(result.corrected, c.corrected, c.name)
        }
    }

    func testRatioCountsUTF16LikeTheServer() {
        let text = "aaaa bbbb"
        let result = EditValidator.check(text: text, edits: [ProposedEdit(original: "aaaa", replacement: "cccccc")], protectedTerms: [])
        XCTAssertEqual(result.changedRatio, 6.0 / 9.0, accuracy: 1e-9)
        XCTAssertFalse(EditValidator.check(text: "", edits: [], protectedTerms: []).rewriteSuspected)
    }

    func testDigitsAreASCIIOnly() {
        XCTAssertEqual(EditValidator.digits("£1,200.50 on 3 May"), "1200503")
        XCTAssertEqual(EditValidator.digits("٣ ten"), "")
    }

    func testOccurrencesAreNonOverlapping() {
        XCTAssertEqual(EditValidator.occurrences(of: "aa", in: "aaaa").count, 2)
        XCTAssertEqual(EditValidator.occurrences(of: "", in: "abc").count, 0)
    }
}
