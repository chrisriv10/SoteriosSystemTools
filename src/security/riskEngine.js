function levelFromScore(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}

function scoreSignals(signals) {
  const score = signals.reduce((total, signal) => total + (signal.points || 0), 0);
  return Math.max(0, Math.min(100, score));
}

function makeRisk(signals) {
  const score = scoreSignals(signals);
  return {
    score,
    level: levelFromScore(score),
    signals: signals.filter((signal) => signal && signal.message)
  };
}

function recommendationForRisk(risk, subject = 'item') {
  if (!risk || risk.score === 0) return 'No action needed.';
  if (risk.score >= 80) return `Quarantine or disable this ${subject} until it is verified.`;
  if (risk.score >= 60) return `Review this ${subject} before allowing it to continue running.`;
  if (risk.score >= 35) return `Inspect publisher, path, and purpose for this ${subject}.`;
  return `Keep this ${subject} under observation.`;
}

module.exports = {
  levelFromScore,
  scoreSignals,
  makeRisk,
  recommendationForRisk
};
