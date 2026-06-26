class RealTimeWatcher {
  constructor(db, eventBus, scanEngine) {
    this.db = db;
    this.eventBus = eventBus;
    this.scanEngine = scanEngine;
    this.isRunning = false;
  }

  start() { this.isRunning = true; }
  stop() { this.isRunning = false; }
  getStatus() { return this.isRunning; }
}
module.exports = RealTimeWatcher;
