import os

view_path = r'C:\ObsidianDev\plugins\A1OneNote\src\OneNoteView.svelte'

with open(view_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('{selectedNotebook ? selectedNotebook.name : "Select Notebook"}', '{$selectedNotebook ? $selectedNotebook.name : "Select Notebook"}')
content = content.replace('Notebooks ({notebooks.length})', 'Notebooks ({$notebooks.length})')
content = content.replace('{#if notebooks.length === 0}', '{#if $notebooks.length === 0}')
content = content.replace('{#each notebooks as nb (nb.folderPath)}', '{#each $notebooks as nb (nb.folderPath)}')

content = content.replace('{#if sections.length === 0}', '{#if $sections.length === 0}')
content = content.replace('{#each sections as sec (sec.folderPath)}', '{#each $sections as sec (sec.folderPath)}')

content = content.replace('{#if selectedSection}', '{#if $selectedSection}')
content = content.replace('{#if selectedSection.pages.length === 0}', '{#if $selectedSection.pages.length === 0}')

content = content.replace('sectionFolderPath={$selectedSection ? $selectedSection?.folderPath : ""}', 'sectionFolderPath={$selectedSection?.folderPath || ""}')
content = content.replace('visiblePages={$selectedSection ? $selectedSection?.pages : []}', 'visiblePages={$selectedSection?.pages || []}')

# Remove unused props from tree components in OneNoteView.svelte:
content = content.replace('''                                <NotebookTreeItem 
                                    notebook={nb}
                                    {selectedNotebook}
                                    {app}
                                    onSelect={selectNotebook}
                                />''', '''                                <NotebookTreeItem notebook={nb} />''')

content = content.replace('''                    <SectionTreeItem 
                        {sec} 
                        {selectedSection}
                        {app}
                        {plugin}
                        onSelect={selectSection}
                    />''', '''                    <SectionTreeItem {sec} />''')

content = content.replace('''                            <PageTreeItem 
                                {page}
                                depth={0}
                                {activePagePath}
                                {app}
                                {plugin}
                                sectionFolderPath={$selectedSection?.folderPath || ""}
                                visiblePages={$selectedSection?.pages || []}
                                onClick={openPage}
                                onAuxClick={handlePageAuxClick}
                                onContextMenu={handlePageContextMenu}
                            />''', '''                            <PageTreeItem 
                                {page}
                                depth={0}
                                onClick={openPage}
                                onAuxClick={handlePageAuxClick}
                                onContextMenu={handlePageContextMenu}
                            />''')


with open(view_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("OneNoteView successfully updated!")
