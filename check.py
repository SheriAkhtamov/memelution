import os

# --- НАСТРОЙКИ ---
OUTPUT_FILE = "PROJECT_FULL_REPORT.md"

# Папки, которые нужно игнорировать (точное совпадение)
IGNORED_DIRS = {
    '.git', '.idea', '.vscode', '__pycache__', 
    'node_modules', 'venv', 'env', '.DS_Store',
    'dist', 'build', 'coverage', 'migrations'
}

# Файлы, которые нужно игнорировать (точное совпадение)
IGNORED_FILES = {
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 
    '.DS_Store', 'db.sqlite3', OUTPUT_FILE, os.path.basename(__file__)
}

# Расширения файлов, которые считаются бинарными (код не будет показан)
BINARY_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', 
    '.ttf', '.eot', '.mp3', '.mp4', '.mov', '.avi', '.zip', '.tar', 
    '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib', '.bin', '.pkl',
    '.pyc', '.class', '.db', '.sqlite', '.sqlite3'
}

def is_binary(filename):
    """Проверка, является ли файл бинарным по расширению."""
    _, ext = os.path.splitext(filename)
    return ext.lower() in BINARY_EXTENSIONS

def generate_tree(startpath):
    """Генерация визуального дерева структуры проекта."""
    tree_str = "## 1. Структура проекта\n\n```text\n.\n"
    
    for root, dirs, files in os.walk(startpath):
        # Фильтрация папок
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        
        level = root.replace(startpath, '').count(os.sep)
        indent = '│   ' * (level)
        subindent = '│   ' * (level + 1)
        
        if root != startpath:
            tree_str += f"{indent}├── {os.path.basename(root)}/\n"
            
        for f in files:
            if f not in IGNORED_FILES:
                tree_str += f"{subindent}├── {f}\n"
                
    tree_str += "```\n\n---\n\n"
    return tree_str

def get_file_content(filepath):
    """Чтение содержимого файла."""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            # Если файл пустой
            if not content.strip():
                return "[Файл пуст]"
            return content
    except Exception as e:
        return f"[ОШИБКА ЧТЕНИЯ: {e}]"

def main():
    root_dir = os.getcwd()
    report_content = []
    
    print(f"Запуск анализа в: {root_dir}")
    print("Генерация отчета...")
    
    # 1. Заголовок и Дерево
    report_content.append(f"# Полный отчет по проекту: {os.path.basename(root_dir)}\n\n")
    report_content.append(generate_tree(root_dir))
    
    # 2. Содержимое файлов
    report_content.append("## 2. Содержимое файлов\n\n")
    
    file_count = 0
    
    for root, dirs, files in os.walk(root_dir):
        # Фильтрация игнорируемых папок на лету
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        
        for file in files:
            if file in IGNORED_FILES:
                continue
            
            # Если файл начинается с точки (скрытый), и это не .env, пропускаем (по желанию)
            # if file.startswith('.') and file != '.env': continue

            file_path = os.path.join(root, file)
            
            # Получаем относительный путь для заголовка (например: app/main.py)
            rel_path = os.path.relpath(file_path, root_dir)
            
            print(f"Обработка: {rel_path}")
            
            report_content.append(f"### 📄 Файл: `{rel_path}`\n")
            
            if is_binary(file):
                report_content.append("> *[Бинарный файл или медиа-ресурс, содержимое скрыто]*\n\n")
            else:
                ext = os.path.splitext(file)[1].replace('.', '') or 'text'
                content = get_file_content(file_path)
                
                # Экранирование тройных кавычек Markdown, чтобы не ломать верстку
                if "```" in content:
                    content = content.replace("```", "'''")
                
                report_content.append(f"```{ext}\n{content}\n```\n\n")
            
            report_content.append("---\n")
            file_count += 1

    # Запись в файл
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write("".join(report_content))
        print(f"\n✅ Готово! Обработано файлов: {file_count}")
        print(f"Отчет сохранен как: {OUTPUT_FILE}")
    except PermissionError:
        print(f"\n❌ Ошибка: Не удалось записать файл. Закрой {OUTPUT_FILE}, если он открыт.")

if __name__ == "__main__":
    main()