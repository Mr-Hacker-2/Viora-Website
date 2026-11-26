/** Editing a turn replaces only the latest user/assistant pair; older context remains intact. */
export function editableUserIndex(messages, { busy = false, hasChatAttachments = false } = {}) {
  if (busy || hasChatAttachments || !Array.isArray(messages) || messages.length < 2) return -1;
  const index = messages.length - 2, user = messages[index], reply = messages[index + 1];
  if (user?.role !== 'user' || reply?.role !== 'assistant' || (user.att || []).length) return -1;
  return index;
}

export function historyBeforeEditedTurn(messages, index) {
  if (editableUserIndex(messages) !== index) return null;
  return messages.slice(0, index);
}
