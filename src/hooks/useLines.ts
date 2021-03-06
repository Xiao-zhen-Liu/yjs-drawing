import * as Y from "yjs";
import * as React from "react";
import { yLines, provider, undoManager, doc, awareness } from "../y";
import { User } from "../types";

/**
 * Subscribe to changes in the document's lines and get functions
 * for creating, update, and modifying the document's lines.
 */
export function useLines() {
  const rLastClear = React.useRef(Date.now());
  const [isSynced, setIsSynced] = React.useState(false);
  const [lines, setLines] = React.useState<Y.Map<any>[]>([]);
  const rCurrentLine = React.useRef<Y.Map<any>>();

  // Observe changes to the yLines shared array; and when
  // changes happen, update the React state with the current
  // value of yLines.
  React.useEffect(() => {
    function handleChange() {
      const lines = yLines.toArray();
      setLines(lines);
    }

    yLines.observe(handleChange);

    return () => yLines.unobserve(handleChange);
  }, []);

  // When the user starts a new line, create a new shared
  // array and add it to the yLines shared array. Store a
  // ref to the new line so that we can update it later.
  const startLine = React.useCallback((point: number[]) => {
    const id = Date.now().toString();
    const yPoints = new Y.Array<number>();
    yPoints.push([...point]);

    const yLine = new Y.Map();

    // Make sure that the next undo starts with the
    // transaction we're about to make.
    undoManager.stopCapturing();

    const user = awareness.getLocalState() as User;

    doc.transact(() => {
      yLine.set("id", id);
      yLine.set("points", yPoints);
      yLine.set("userColor", user.color);
      yLine.set("isComplete", false);
    });

    rCurrentLine.current = yLine;

    yLines.push([yLine]);
  }, []);

  // When the user draws, add the new point to the current
  // line's points array. This will be subscribed to in a
  // different hook.
  const addPointToLine = React.useCallback((point: number[]) => {
    const currentLine = rCurrentLine.current;

    if (!currentLine) return;

    const points = currentLine.get("points");

    // Don't add the new point to the line
    if (!points) return;

    points.push([...point]);
  }, []);

  // When the user finishes, update the `isComplete` property
  // of the line.
  const completeLine = React.useCallback(() => {
    const currentLine = rCurrentLine.current;

    if (!currentLine) return;

    currentLine.set("isComplete", true);

    rCurrentLine.current = undefined;
  }, []);

  // Clear all of the lines in the line
  const clearAllLines = React.useCallback(() => {
    const now = Date.now();
    const lastTime = rLastClear.current || 0;
    if (now - lastTime < 60000) return;
    rLastClear.current = now;
    yLines.delete(0, yLines.length);
  }, []);

  // Undo the most recently done line
  const undoLine = React.useCallback(() => {
    undoManager.undo();
  }, []);

  // Redo the most recently undone line
  const redoLine = React.useCallback(() => {
    undoManager.redo();
  }, []);

  // Handle the provider connection. Include a listener
  // on the window to disconnect automatically when the
  // tab or window closes.
  React.useEffect(() => {
    function handleConnect() {
      setIsSynced(true);
      setLines(yLines.toArray());
    }

    function handleDisconnect() {
      provider.off("sync", handleConnect);
      provider.disconnect();
    }

    window.addEventListener("beforeunload", handleDisconnect);

    provider.on("sync", handleConnect);

    provider.connect();

    return () => {
      handleDisconnect();
      window.removeEventListener("beforeunload", handleDisconnect);
    };
  }, []);

  return {
    isSynced,
    lines,
    startLine,
    addPointToLine,
    completeLine,
    clearAllLines,
    undoLine,
    redoLine
  };
}
