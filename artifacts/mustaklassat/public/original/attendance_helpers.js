
  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog) {
      dialog.style.display = 'block';
    } else {
      console.warn('Dialog ID not found:', id);
    }
  }

  function exportToExcel(tableId = 'cleaning-table') {
    const table = document.getElementById(tableId);
    if (!table) return alert('لم يتم العثور على الجدول');
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, 'attendance.xlsx');
  }

function zoomInTable(tableId) {
  const table = document.getElementById(tableId);
  if (table) {
    // اقرأ الزوم الحالي، أو افترض أنه 1 إذا لم يكن موجوداً
    const currentZoom = parseFloat(table.style.zoom) || 1;
    // قم بزيادة الزوم بنسبة 0.1 في كل مرة، بحد أقصى 2
    table.style.zoom = Math.min(currentZoom + 0.1, 2);
  }
}

function zoomOutTable(tableId) {
  const table = document.getElementById(tableId);
  if (table) {
    // اقرأ الزوم الحالي
    const currentZoom = parseFloat(table.style.zoom) || 1;
    // قم بإنقاص الزوم بنسبة 0.1، بحد أدنى 0.5
    table.style.zoom = Math.max(currentZoom - 0.1, 0.5);
  }
}
