/**
 * Docs Paper Copilot - Text Diff Viewer
 * Lightweight token-level comparison between original and revised text.
 */

export const DiffViewer = {
  tokenize(text) {
    if (!text) return [];
    return text.split(/(\s+|[.,!?;:()"])/).filter(Boolean);
  },

  computeDiff(original, revised) {
    const origTokens = this.tokenize(original);
    const revTokens = this.tokenize(revised);

    const result = [];
    let i = 0;
    let j = 0;

    while (i < origTokens.length || j < revTokens.length) {
      if (i < origTokens.length && j < revTokens.length && origTokens[i] === revTokens[j]) {
        result.push({ type: "same", value: origTokens[i] });
        i++;
        j++;
      } else if (j < revTokens.length && !origTokens.slice(i, i + 5).includes(revTokens[j])) {
        result.push({ type: "added", value: revTokens[j] });
        j++;
      } else if (i < origTokens.length) {
        result.push({ type: "removed", value: origTokens[i] });
        i++;
      } else {
        result.push({ type: "added", value: revTokens[j] });
        j++;
      }
    }

    return result;
  },

  renderToElement(container, original, revised) {
    container.innerHTML = "";
    if (!original && !revised) {
      container.textContent = "Tidak ada teks untuk dibandingkan.";
      return;
    }

    const diffs = this.computeDiff(original, revised);
    const fragment = document.createDocumentFragment();

    for (const item of diffs) {
      const span = document.createElement("span");
      span.textContent = item.value;

      if (item.type === "added") {
        span.className = "diff-tag diff-added";
      } else if (item.type === "removed") {
        span.className = "diff-tag diff-removed";
      } else {
        span.className = "diff-same";
      }

      fragment.appendChild(span);
    }

    container.appendChild(fragment);
  }
};
