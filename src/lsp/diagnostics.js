import { DiagnosticSeverity } from 'vscode-languageserver/node.js';

// One job per URI. Identity guards also handle close/reopen with the same version.
export function createDiagnostics({ documents, publish, inspect, delay = 200, onError = () => {} }) {
  const jobs = new Map();
  function cancel(uri) {
    const job = jobs.get(uri);
    if (job) { clearTimeout(job.timer); job.controller.abort(); jobs.delete(uri); }
  }
  function schedule(document) {
    cancel(document.uri);
    const { uri, version } = document;
    const text = document.getText();
    const job = { controller: new AbortController() };
    jobs.set(uri, job);
    const current = () => jobs.get(uri) === job && documents.get(uri) === document && document.version === version;
    job.timer = setTimeout(async () => {
      try {
        const findings = await inspect(text, job.controller.signal);
        if (!current()) return;
        publish({ uri, version, diagnostics: findings.map(finding => ({
          range: { start: document.positionAt(finding.start), end: document.positionAt(finding.end) },
          message: finding.message,
          severity: DiagnosticSeverity.Information,
          source: 'writing-tools-conversion',
        })) });
      } catch {
        if (current()) {
          publish({ uri, version, diagnostics: [] });
          onError('Writing Tools: 診断に失敗しました。');
        }
      } finally { if (jobs.get(uri) === job) jobs.delete(uri); }
    }, delay);
  }
  return {
    schedule,
    close(uri) { cancel(uri); publish({ uri, diagnostics: [] }); },
    dispose() { for (const uri of jobs.keys()) cancel(uri); },
  };
}
