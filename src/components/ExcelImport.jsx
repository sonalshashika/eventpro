import React, { useRef } from 'react';
import * as XLSX from 'xlsx';

function ExcelImport({ onImport, onReset, showReset = true, enabledProps = { category: true, table: true }, customColumns = [] }) {
    const fileInputRef = useRef(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            const formattedData = data.map((item, index) => {
                const guest = {
                    id: `guest_import_${Date.now()}_${index}`,
                    name: item.Name || item.name || 'Unknown',
                    arrived: false,
                    statuses: {}
                };

                if (enabledProps.table) {
                    const rawTable = item['Table Number'] || item['table'] || item['Table'] || '0';
                    guest.table = String(rawTable).trim();
                }

                if (enabledProps.category) {
                    guest.category = 
                        item['Category'] ||
                        item['category'] ||
                        item['Catagory'] ||
                        item['catagory'] ||
                        'Guest';
                    guest.category = String(guest.category).trim();
                }

                // Map Custom Columns
                customColumns.forEach(col => {
                    const value = item[col.label] || item[col.id];
                    if (value !== undefined) {
                        if (col.type === 'toggle') {
                            const valStr = String(value).toLowerCase();
                            guest.statuses[col.id] = ['yes', 'true', '1', 'y'].includes(valStr);
                        } else {
                            guest.statuses[col.id] = String(value).trim();
                        }
                    } else {
                        guest.statuses[col.id] = col.type === 'toggle' ? false : '';
                    }
                });

                return guest;
            });

            onImport(formattedData);
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsBinaryString(file);
    };

    const downloadTemplate = () => {
        const headers = ['Name'];
        if (enabledProps.category) headers.push('Category');
        if (enabledProps.table) headers.push('Table Number');
        
        customColumns.forEach(col => {
            headers.push(col.label);
        });

        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Guest_List_Template.xlsx");
    };

    const [resetStep, setResetStep] = React.useState(0);

    const handleResetClick = () => {
        if (resetStep === 0) {
            setResetStep(1);
        } else if (resetStep === 1) {
            setResetStep(2);
        } else {
            onReset();
            setResetStep(0);
        }
    };

    return (
        <div className="import-controls">
            <div className="glass-card import-card">
                <h3>Import Guest List</h3>
                <p className="text-muted">
                    Upload an Excel (.xlsx) or CSV file. 
                    Mandatory: Name. 
                    {enabledProps.table && ' Optional: Table Number.'}
                    {enabledProps.category && ' Optional: Category.'}
                </p>
                <div className="import-actions">
                    <label className="btn-primary">
                        Upload File
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".xlsx, .xls, .csv"
                            style={{ display: 'none' }}
                        />
                    </label>
                    <button className="btn-secondary" onClick={downloadTemplate}>
                        Download Template
                    </button>
                    {showReset && (
                        <>
                            <button
                                className={`btn-secondary ${resetStep > 0 ? 'warning-active' : ''}`}
                                onClick={handleResetClick}
                                onMouseLeave={() => resetStep > 0 && setResetStep(0)}
                            >
                                {resetStep === 0 && 'Reset All Data'}
                                {resetStep === 1 && 'Are you sure?'}
                                {resetStep === 2 && 'REALLY SURE?'}
                            </button>
                            {resetStep > 0 && (
                                <p className="reset-hint animate-fade-in">
                                    Click again to confirm. Mouse away to cancel.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ExcelImport;
