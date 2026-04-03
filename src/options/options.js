(async function initOptions() {
  const settingsApi = globalThis.AtlasTranslate.settings;
  const statusNode = document.getElementById("status");
  const targetLanguageNode = document.getElementById("targetLanguage");
  const inlineModeNode = document.getElementById("inlineMode");
  const selectionEnabledNode = document.getElementById("selectionEnabled");
  const saveButtonNode = document.getElementById("saveButton");

  const settings = await settingsApi.getSettings();
  targetLanguageNode.value = settings.targetLanguage;
  inlineModeNode.value = settings.inlineMode;
  selectionEnabledNode.checked = settings.selectionEnabled;

  saveButtonNode.addEventListener("click", async () => {
    saveButtonNode.disabled = true;
    statusNode.textContent = "保存中…";
    try {
      await settingsApi.saveSettings({
        targetLanguage: targetLanguageNode.value,
        inlineMode: inlineModeNode.value,
        selectionEnabled: selectionEnabledNode.checked
      });
      statusNode.textContent = "设置已保存。";
    } catch (error) {
      statusNode.textContent = error.message || "保存失败。";
    } finally {
      saveButtonNode.disabled = false;
    }
  });
})().catch((error) => {
  console.error("[Atlas X Translate] options init failed", error);
});

