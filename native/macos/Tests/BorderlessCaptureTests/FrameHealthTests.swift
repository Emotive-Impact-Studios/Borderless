import XCTest
@testable import BorderlessCapture

final class FrameHealthTests: XCTestCase {
    func testRealRustBindingDistinguishesMissingFrames() {
        XCTAssertEqual(FrameHealth.evaluate(active: true, started: 100, last: 0, frames: 0, now: 200), .starting)
        XCTAssertEqual(FrameHealth.evaluate(active: true, started: 100, last: 0, frames: 0, now: 10_100), .stale)
    }
    func testRealRustBindingReceivesAndStops() {
        XCTAssertEqual(FrameHealth.evaluate(active: true, started: 100, last: 200, frames: 1, now: 210), .receiving)
        XCTAssertEqual(FrameHealth.evaluate(active: false, started: 100, last: 200, frames: 1, now: 210), .stopped)
    }
    func testClockErrorAcrossABI() {
        XCTAssertEqual(FrameHealth.evaluate(active: true, started: 100, last: 300, frames: 1, now: 200), .invalid)
    }
}
