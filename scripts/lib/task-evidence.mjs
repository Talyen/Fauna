import { createHash, randomUUID } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { git } from "./git.mjs";
import { taskBase } from "./task-selection.mjs";
import { verificationIdentity } from "../checks/input-identity.mjs";

const receiptPath = (root) =>
  path.resolve(root, git(root, ["rev-parse", "--git-path", "fauna-evidence.json"]).trim());

// Include committed, staged, unstaged and untracked inputs; ignored reports are evidence, not source.
export function sourceIdentity(root) {
  const hash = createHash("sha256");
  hash.update(git(root, ["rev-parse", "HEAD"]));
  hash.update(git(root, ["diff", "--no-ext-diff", "--no-textconv", "--binary", "HEAD", "--"]));
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean)
    .sort();
  for (const file of untracked) {
    const absolute = path.join(root, file);
    const stat = lstatSync(absolute);
    hash.update(JSON.stringify([file, stat.mode, stat.size]));
    if (stat.isSymbolicLink()) hash.update(readlinkSync(absolute));
    else if (stat.isFile()) {
      // Receipts must not turn asset authoring into an unbounded memory operation.
      if (stat.size > 16 * 1024 * 1024) throw new Error("Untracked source too large for an evidence receipt");
      hash.update(readFileSync(absolute));
    } else throw new Error("Unsupported untracked source type");
  }
  return hash.digest("hex");
}

export function readTaskEvidence(root, identity = sourceIdentity(root)) {
  try {
    const data = JSON.parse(readFileSync(receiptPath(root), "utf8"));
    if (data.version !== 1 || data.identity !== identity) return {};
    return data.checks && typeof data.checks === "object" ? data.checks : {};
  } catch {
    return {};
  }
}

export function recordTaskEvidence(root, identity, key, value) {
  const checks = readTaskEvidence(root, identity);
  if (value === null) delete checks[key];
  else checks[key] = value;
  const file = receiptPath(root);
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify({ version: 1, identity, checks }) + "\n");
  renameSync(temporary, file);
}

function captureContents(root, file) {
  const reports = realpathSync(path.join(root, "reports"));
  const absolute = realpathSync(path.resolve(root, file));
  if (!absolute.startsWith(`${reports}${path.sep}`) || path.basename(absolute) !== "evidence.json")
    throw new Error("Choose a task capture evidence.json under reports/.");
  const raw = readFileSync(absolute);
  const evidence = JSON.parse(raw);
  if (!evidence.complete || !Array.isArray(evidence.frames) || !evidence.frames.length)
    throw new Error("Capture is incomplete; inspect and retry it before recording a review.");
  const digest = createHash("sha256").update(raw);
  for (const frame of evidence.frames) {
    if (
      typeof frame.file !== "string" ||
      path.basename(frame.file) !== frame.file ||
      !Array.isArray(frame.errors) ||
      frame.errors.length ||
      !Array.isArray(frame.layoutFailures) ||
      frame.layoutFailures.length
    )
      throw new Error("Capture has missing frames or reported errors.");
    const image = realpathSync(path.join(path.dirname(absolute), frame.file));
    if (path.dirname(image) !== path.dirname(absolute))
      throw new Error("Capture frame is outside its report.");
    if (lstatSync(image).size > 16 * 1024 * 1024)
      throw new Error("Capture frame is too large for a receipt.");
    digest.update(readFileSync(image));
  }
  return { evidence, digest: digest.digest("hex"), file: path.relative(root, absolute) };
}

/** Explicit human/agent attestation after inspecting a complete, current-source capture. */
export function recordVisualReview(root, file, env = process.env) {
  const identity = sourceIdentity(root);
  const capture = captureContents(root, file);
  if (capture.evidence.source !== verificationIdentity(root, taskBase(root), [], env, "capture"))
    throw new Error("Capture source or environment differs from the current checkout; capture again.");
  if (sourceIdentity(root) !== identity) throw new Error("Source changed while recording review; retry.");
  recordTaskEvidence(root, identity, "visual", { file: capture.file, digest: capture.digest });
}

export function visualReviewStatus(root, visual) {
  try {
    if (!visual || typeof visual.file !== "string" || typeof visual.digest !== "string") return null;
    return captureContents(root, visual.file).digest === visual.digest ? visual.file : null;
  } catch {
    return null;
  }
}
