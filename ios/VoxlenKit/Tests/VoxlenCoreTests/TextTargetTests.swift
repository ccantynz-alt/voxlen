import XCTest
@testable import VoxlenCore

final class TextTargetTests: XCTestCase {
    func sentence(_ before: String) -> FixTarget? {
        TextTargeting.target(before: before, selected: nil)
    }

    func testSelectionWins() {
        XCTAssertEqual(TextTargeting.target(before: "Ignored. ", selected: "teh fee"), .selection("teh fee"))
        XCTAssertEqual(TextTargeting.target(before: "One. Two", selected: "   "), .sentence(text: "Two", trailing: ""))
    }

    func testNothingToFix() {
        XCTAssertNil(sentence(""))
        XCTAssertNil(sentence("   "))
        XCTAssertNil(TextTargeting.target(before: nil, selected: nil))
    }

    // The old keyboard sent an empty string here and showed "check API key".
    func testJustFinishedSentenceIsTheTarget() {
        XCTAssertEqual(sentence("I goes home. "), .sentence(text: "I goes home.", trailing: " "))
    }

    // The old keyboard trimmed the target but deleted the untrimmed length,
    // turning "First. second sentence " into "First. sSecond sentence.".
    func testTrailingWhitespaceIsKeptOutsideTheTarget() {
        XCTAssertEqual(sentence("First. second sentence "), .sentence(text: "second sentence", trailing: " "))
    }

    func testDecimalsAndAbbreviationsDoNotEndASentence() {
        XCTAssertEqual(sentence("Done. The fee rose 1.5 times"), .sentence(text: "The fee rose 1.5 times", trailing: ""))
        XCTAssertEqual(sentence("See Smith v. Jones at para. 4 was right"), .sentence(text: "See Smith v. Jones at para. 4 was right", trailing: ""))
        XCTAssertEqual(sentence("Acme Pty. Ltd. e.g. this one"), .sentence(text: "Acme Pty. Ltd. e.g. this one", trailing: ""))
        XCTAssertEqual(sentence("Signed by J. Smith today"), .sentence(text: "Signed by J. Smith today", trailing: ""))
    }

    func testOtherSentenceEnds() {
        XCTAssertEqual(sentence("Really? yes it is"), .sentence(text: "yes it is", trailing: ""))
        XCTAssertEqual(sentence("Line one\nline two"), .sentence(text: "line two", trailing: ""))
        XCTAssertEqual(sentence("Dear Sir,\n\n"), .sentence(text: "Dear Sir,", trailing: "\n\n"))
    }

    func testPlanRetypesOnlyFromTheFirstChange() throws {
        let target = FixTarget.sentence(text: "She go to court.", trailing: " ")
        let plan = try XCTUnwrap(TextTargeting.plan(for: target, corrected: "She goes to court."))
        XCTAssertEqual(plan.requiredSuffix, "She go to court. ")
        XCTAssertEqual(plan.deleteCount, " to court. ".count)
        XCTAssertEqual(plan.insert, "es to court. ")
        XCTAssertFalse(plan.replacesSelection)

        // Running the plan, then its undo, round-trips the text.
        let fixed = apply(deleteCount: plan.deleteCount, insert: plan.insert, to: "Note. She go to court. ")
        XCTAssertEqual(fixed, "Note. She goes to court. ")
        XCTAssertTrue(fixed.hasSuffix(plan.undo.requiredSuffix))
        XCTAssertEqual(apply(deleteCount: plan.undo.deleteCount, insert: plan.undo.insert, to: fixed), "Note. She go to court. ")
    }

    func testPlanForSelection() throws {
        let plan = try XCTUnwrap(TextTargeting.plan(for: .selection("teh fee"), corrected: "the fee"))
        XCTAssertTrue(plan.replacesSelection)
        XCTAssertEqual(plan.insert, "the fee")
        XCTAssertEqual(plan.undo, UndoPlan(requiredSuffix: "the fee", deleteCount: 7, insert: "teh fee"))
    }

    func testNoPlanWhenNothingChanges() {
        XCTAssertNil(TextTargeting.plan(for: .sentence(text: "Fine.", trailing: ""), corrected: "Fine."))
    }

    func testPlanCountsCharactersNotScalars() throws {
        let target = FixTarget.sentence(text: "Café 👩‍⚖️ denyed", trailing: "")
        let plan = try XCTUnwrap(TextTargeting.plan(for: target, corrected: "Café 👩‍⚖️ denied"))
        // The emoji is one Character (one deleteBackward), and sits in the shared prefix.
        XCTAssertEqual(plan.deleteCount, "yed".count)
        XCTAssertEqual(plan.insert, "ied")
    }

    /// What deleteBackward() × n then insertText() do to the text before the cursor.
    private func apply(deleteCount: Int, insert: String, to text: String) -> String {
        String(text.dropLast(deleteCount)) + insert
    }
}
