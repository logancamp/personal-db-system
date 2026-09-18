const RUN_REF = /\(ref\s+([A-Za-z0-9][A-Za-z0-9-]{3,63})\)\s*$/;

export function extractRunRef(msg: string | null | undefined): string | null {
  if (!msg) return null;
  const match = RUN_REF.exec(msg.trim());
  return match ? match[1] : null;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea copy below
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
