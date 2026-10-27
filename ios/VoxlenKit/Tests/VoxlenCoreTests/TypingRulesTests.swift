import XCTest
@testable import VoxlenCore

final class TypingRulesTests: XCTestCase {
    func testSentenceCapitalization() {
        let cap = { TypingRules.shouldCapitalize(before: $0, mode: .sentences) }
        XCTAssertTrue(cap(nil))
        XCTAssertTrue(cap(""))
        XCTAssertTrue(cap("Done. "))
        XCTAssertTrue(cap("Really?  "))
        XCTAssertTrue(cap("Dear Sir,\n"))
        XCTAssertTrue(cap("   "))
        XCTAssertFalse(cap("Done."))
        XCTAssertFalse(cap("Dear Sir, "))
        XCTAssertFalse(cap("word"))
    }

    func testOtherModes() {
        XCTAssertFalse(TypingRules.shouldCapitalize(before: "", mode: .none))
        XCTAssertTrue(TypingRules.shouldCapitalize(before: "abc", mode: .allCharacters))
        XCTAssertTrue(TypingRules.shouldCapitalize(before: "New ", mode: .words))
        XCTAssertFalse(TypingRules.shouldCapitalize(before: "New", mode: .words))
    }

    func testDoubleSpacePeriod() {
        XCTAssertTrue(TypingRules.doubleSpaceMakesPeriod(before: "court "))
        XCTAssertTrue(TypingRules.doubleSpaceMakesPeriod(before: "clause 4 "))
        XCTAssertTrue(TypingRules.doubleSpaceMakesPeriod(before: "(see above) "))
        XCTAssertFalse(TypingRules.doubleSpaceMakesPeriod(before: "court"))
        XCTAssertFalse(TypingRules.doubleSpaceMakesPeriod(before: "court.  "))
        XCTAssertFalse(TypingRules.doubleSpaceMakesPeriod(before: "court. "))
        XCTAssertFalse(TypingRules.doubleSpaceMakesPeriod(before: " "))
        XCTAssertFalse(TypingRules.doubleSpaceMakesPeriod(before: nil))
    }

    func testLayoutShape() {
        let letters = KeyboardLayout.rows(for: .letters)
        XCTAssertEqual(letters.map(\.count), [10, 9, 9, 4])
        XCTAssertEqual(letters[2].first, .shift)
        XCTAssertEqual(letters[2].last, .delete)
        XCTAssertEqual(letters[3], [.page(.numbers), .globe, .space, .returnKey])
        XCTAssertEqual(KeyboardLayout.rows(for: .numbers)[0].count, 10)
        XCTAssertEqual(KeyboardLayout.rows(for: .symbols)[2].first, .page(.numbers))
    }
}
