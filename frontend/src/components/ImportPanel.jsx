import { useRef, useState, useEffect, useCallback } from "react";
import { startImport, getImportStatus } from "../api.js";

const POLL_MS = 350;

export default function ImportPanel({ onImported }) {
  const inputRef = useRef(null);
  const pollRef = useRef(null);
  const [job, setJob] = useState(null); // status payload while running/done/error
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const poll = useCallback((jobId) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await getImportStatus(jobId);
        setJob(status);
        if (status.status !== "running") {
          clearInterval(pollRef.current);
          if (status.status === "done") onImported?.();
        }
      } catch (err) {
        clearInterval(pollRef.current);
        setJob({ status: "error", error: err.message });
      }
    }, POLL_MS);
  }, [onImported]);

  async function handleFile(file) {
    if (!file) return;
    clearInterval(pollRef.current);
    setJob({ status: "uploading", processed: 0, total: 0 });
    try {
      const { job_id, total } = await startImport(file);
      setJob({ status: "running", processed: 0, total, trips_imported: 0, trips_skipped: 0 });
      poll(job_id);
    } catch (err) {
      setJob({ status: "error", error: err.message || "Échec de l'import." });
    }
  }

  const busy = job && (job.status === "uploading" || job.status === "running");
  const pct = job && job.total ? Math.min(100, Math.round((job.processed / job.total) * 100)) : job?.status === "uploading" ? 0 : 100;

  return (
    <div
      className={`flex flex-col gap-2 rounded-md border px-4 py-2.5 transition-colors ${
        dragOver ? "border-cobalt-500 bg-cobalt-500/10" : "border-graphite-600 bg-graphite-800"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="shrink-0 rounded bg-cobalt-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-cobalt-600 disabled:opacity-50"
        >
          {busy ? "Import en cours…" : "Importer un export JSON"}
        </button>

        {!job && <span className="text-sm text-mist-500">ou glissez-déposez un fichier .json ici</span>}

        {job?.status === "error" && (
          <span className="text-sm text-red-400">{job.error || "Échec de l'import."}</span>
        )}

        {job?.status === "done" && (
          <span className="num text-sm text-emerald-400">
            {job.trips_imported} trajet(s) importé(s)
            {job.trips_skipped ? `, ${job.trips_skipped} ignoré(s)/déjà présents` : ""}
            {job.trips_anomalous ? `, ${job.trips_anomalous} avec des valeurs corrigées` : ""}.
          </span>
        )}

        {busy && (
          <span className="num text-sm text-mist-500">
            {job.status === "uploading"
              ? "Envoi du fichier…"
              : `${job.processed.toLocaleString("fr-FR")} / ${job.total.toLocaleString("fr-FR")} trajets`}
          </span>
        )}
      </div>

      {busy && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-graphite-700">
          <div
            className={`h-full rounded-full bg-cobalt-500 transition-all duration-150 ${
              job.status === "uploading" ? "w-1/12 animate-pulse" : ""
            }`}
            style={job.status === "running" ? { width: `${pct}%` } : undefined}
          />
        </div>
      )}
    </div>
  );
}
