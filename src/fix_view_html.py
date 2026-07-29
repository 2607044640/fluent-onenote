import re

view_path = r'C:\ObsidianDev\plugins\A1OneNote\src\OneNoteView.svelte'

with open(view_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Store bindings
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
    
    "onDragStart={handleDragStart}": "",
    "onDragOver={handleDragOver}": "",
    "onDrop={handleDrop}": "",
    "onDragEnd={handleDragEnd}": "",
    "onRefresh={() => loadNotebooks()}": "",
    "onSelect={selectNotebook}": "",
    "onSelect={selectSection}": "",
    "onClick={openPage}": "onClick={openPage}",
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open(view_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("HTML bindings updated!")
