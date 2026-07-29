import os
import re

view_path = r'C:\ObsidianDev\plugins\A1OneNote\src\OneNoteModalView.svelte'

with open(view_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject Context and ViewModel
import_inject = """import { OneNoteViewModel } from "./store/OneNoteViewModel";
    import { setContext } from "svelte";"""
content = content.replace('import { DragDropHelper } from "./DragDropHelper";', 'import { DragDropHelper } from "./DragDropHelper";\n    ' + import_inject)

vm_setup = """    // ViewModel setup
    const vm = new OneNoteViewModel(app, plugin, dataService, rootFolder, initialExpandedPaths, initialSelectedSectionPath);
    setContext("vm", vm);
    
    // Subscribe to stores for local reactivity
    const notebooks = vm.notebooks;
    const selectedNotebook = vm.selectedNotebook;
    const sections = vm.sections;
    const selectedSection = vm.selectedSection;
    const activePagePath = vm.activePagePath;
    const rootFolderExists = vm.rootFolderExists;
    const draggedItemId = vm.draggedItemId;
    const dragOverId = vm.dragOverId;
    const dragPosition = vm.dragPosition;
"""
# Replace the state definitions in OneNoteModalView
state_regex = r"    let notebooks: NotebookInfo\[\] = \[\];.*?let rootFolderExists: boolean = true;"
content = re.sub(state_regex, vm_setup, content, flags=re.DOTALL)

# Delete loadNotebooks (handled by VM)
load_notebooks_regex = r"    function checkFolderExists.*?function selectNotebook"
content = re.sub(load_notebooks_regex, "    function selectNotebook", content, flags=re.DOTALL)

# Replace the HTML store bindings and remove DnD props
replacements = {
    "notebooks.length": "$notebooks.length",
    "{notebooks.length}": "{$notebooks.length}",
    "each notebooks as": "each $notebooks as",
    "{selectedNotebook}": "{$selectedNotebook}",
    "selectedNotebook ?": "$selectedNotebook ?",
    "selectedNotebook.folderPath": "$selectedNotebook?.folderPath",
    "selectedNotebook.name": "$selectedNotebook?.name",
    
    "sections.length": "$sections.length",
    "each sections as": "each $sections as",
    "{selectedSection}": "{$selectedSection}",
    "selectedSection ?": "$selectedSection ?",
    "selectedSection.pages": "$selectedSection?.pages",
    "selectedSection.folderPath": "$selectedSection?.folderPath",

    "{draggedItemId}": "{$draggedItemId}",
    "{dragOverId}": "{$dragOverId}",
    "{dragPosition}": "{$dragPosition}",
    "{activePagePath}": "{$activePagePath}",
    "{rootFolderExists}": "{$rootFolderExists}",

    # Remove props from tree items
    "onDragStart={handleDragStart}": "",
    "onDragOver={handleDragOver}": "",
    "onDrop={handleDrop}": "",
    "onDragEnd={handleDragEnd}": "",
    "onRefresh={() => loadNotebooks()}": "",
    "onRefresh={() => vm.loadNotebooks()}": "",
    "onSelect={selectNotebook}": "",
    "onSelect={selectSection}": "",
}

for old, new in replacements.items():
    content = content.replace(old, new)

# Fix vm.loadNotebooks() in contexts
content = content.replace("loadNotebooks();", "vm.loadNotebooks();")
content = content.replace("vm.vm.loadNotebooks();", "vm.loadNotebooks();")

# Remove handleDragEnd etc completely to avoid TS errors
dnd_func_regex = r"    // DnD State Machine.*?function handleDrop.*?return;\n        }\n    }"
content = re.sub(dnd_func_regex, "    // DnD logic moved to ViewModel", content, flags=re.DOTALL)

# Cleanup other TS errors:
content = content.replace('const refModify = activeApp.vault.on("modify", () => loadNotebooks());', 'const refModify = activeApp.vault.on("modify", () => vm.loadNotebooks());')
content = content.replace('const refDelete = activeApp.vault.on("delete", () => loadNotebooks());', 'const refDelete = activeApp.vault.on("delete", () => vm.loadNotebooks());')
content = content.replace('const refCreate = activeApp.vault.on("create", () => loadNotebooks());', 'const refCreate = activeApp.vault.on("create", () => vm.loadNotebooks());')
content = content.replace('const refRename = activeApp.vault.on("rename", () => loadNotebooks());', 'const refRename = activeApp.vault.on("rename", () => vm.loadNotebooks());')

# Fix store subscriptions for array manipulation in the component
# visibleSections depends on $sections
content = content.replace("$: visibleSections = flattenVisibleSections(sections);", "$: visibleSections = flattenVisibleSections($sections);")
# filteredPages depends on notebooks
content = content.replace("const allPages = getAllPagesRecursive($sections);", "const allPages = getAllPagesRecursive($sections);")
content = content.replace("getAllPagesRecursive(sections)", "getAllPagesRecursive($sections)")
content = content.replace("DataService.getFlattenedPages(selectedSection.pages)", "DataService.getFlattenedPages($selectedSection?.pages || [])")

# Replace sections assignment with vm.sections.set or use vm methods
content = content.replace("sections =", "/* removed sections assignment */ //")
content = content.replace("selectedNotebook =", "/* removed selectedNotebook assignment */ //")
content = content.replace("selectedSection =", "/* removed selectedSection assignment */ //")
content = content.replace("activePagePath =", "/* removed activePagePath assignment */ //")

with open(view_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("OneNoteModalView rewritten!")
