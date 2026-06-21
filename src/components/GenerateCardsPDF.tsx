import React, { useState } from 'react';
import { useStore } from '../store';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

function generateRandomCard(): number[] {
  const card = Array(25).fill(0);
  const getColNums = (min: number, max: number) => {
    const nums: number[] = [];
    while (nums.length < 5) {
      const n = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!nums.includes(n)) nums.push(n);
    }
    return nums;
  };
  
  const b = getColNums(1, 15);
  const idx_i = getColNums(16, 30);
  const n = getColNums(31, 45);
  const g = getColNums(46, 60);
  const o = getColNums(61, 75);
  
  for (let i = 0; i < 5; i++) {
    card[i * 5] = b[i];
    card[i * 5 + 1] = idx_i[i];
    card[i * 5 + 2] = i === 2 ? 0 : n[i]; // Free space
    card[i * 5 + 3] = g[i];
    card[i * 5 + 4] = o[i];
  }
  return card;
}

export function PrintCardsButton() {
  const [printing, setPrinting] = useState(false);
  const [quantity, setQuantity] = useState(10);
  const { masterCards, addMasterCard } = useStore();

  const handlePrint = async () => {
    setPrinting(true);
    
    // Generate new cards
    const newCards = [];
    for (let i = 0; i < quantity; i++) {
      const numbers = generateRandomCard();
      const id = uuidv4();
      const numSerial = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
      const card = {
        id,
        name: `CARTELA ${masterCards.length + i + 1}`,
        cardNumber: numSerial,
        numbers
      };
      newCards.push(card);
      addMasterCard(card); // Save directly to store
    }
    
    // Build HTML for print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-ups bloqueados. Por favor permita para imprimir.");
        setPrinting(false);
        return;
    }

    const css = `
      body { font-family: sans-serif; margin: 0; padding: 0; background: white; color: black; }
      .page { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; page-break-after: always; }
      .card { border: 2px solid black; padding: 10px; break-inside: avoid; }
      .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; }
      .title { font-size: 24px; font-weight: bold; text-transform: uppercase; margin: 0; }
      .serial { font-size: 14px; color: #555; }
      .qr { margin-left: 10px; }
      .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px; background: black; border: 2px solid black; }
      .grid-header { background: white; text-align: center; font-weight: bold; font-size: 20px; padding: 5px 0; }
      .cell { background: white; text-align: center; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; }
      .cell.free { background: #f0f0f0; font-size: 14px; }
    `;

    let html = `<html><head><style>${css}</style></head><body>`;
    
    // Convert cards to HTML strings
    for (let i = 0; i < newCards.length; i+=4) {
      html += '<div class="page">';
      for (let j = 0; j < 4 && i+j < newCards.length; j++) {
        const card = newCards[i+j];
        
        // Render QR SVG to string manually 
        // A minimal JSON for QR: { "id": card.id, "numbers": card.numbers, "cardNumber": card.cardNumber }
        // Let's just use JSON string inside the QR
        const qrData = JSON.stringify({ id: card.id, numbers: card.numbers, serial: card.cardNumber });
        
        html += `
          <div class="card">
            <div class="header">
              <div>
                <h2 class="title">${card.name}</h2>
                <div class="serial">Serial: ${card.cardNumber}</div>
              </div>
              <div class="qr" id="qr-${card.id}"></div>
            </div>
            <div class="grid">
              <div class="grid-header">B</div>
              <div class="grid-header">I</div>
              <div class="grid-header">N</div>
              <div class="grid-header">G</div>
              <div class="grid-header">O</div>
        `;
        
        for (let r = 0; r < 5; r++) {
           for (let c = 0; c < 5; c++) {
              const idx = r * 5 + c;
              // transpose because standard bingo grids are columns 0=B(0,5,10,15,20) but we store as standard rows
              const colIdx = c;
              const rowIdx = r;
              const val = card.numbers[rowIdx * 5 + colIdx]; // wait, the standard usually stores B I N G O as cols. Our logic stored B in first column. Oh, our card[i*5 + col] is exactly row i, col.
              // i = row. So cell index is row * 5 + col. Correct.
              if (rowIdx === 2 && colIdx === 2) {
                 html += `<div class="cell free">FREE</div>`;
              } else {
                 html += `<div class="cell">${val}</div>`;
              }
           }
        }
        
        html += `</div></div>`;
      }
      html += `</div>`;
    }

    html += `
      <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
      <script>
        const cards = ${JSON.stringify(newCards)};
        cards.forEach(card => {
           const data = { id: card.id, num: card.cardNumber, arr: card.numbers };
           const qrStr = "BINGO:" + JSON.stringify(data);
           QRCode.toCanvas(qrStr, { width: 80, margin: 1 }, function(err, canvas) {
              if (err) console.error(err);
              document.getElementById('qr-' + card.id).appendChild(canvas);
           });
        });
        setTimeout(() => { window.print(); }, 1000);
      </script>
    `;
    html += `</body></html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
    setPrinting(false);
  };

  return (
    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 mt-6 mb-6 flex flex-col sm:flex-row gap-4 items-end">
       <div className="flex-1 w-full">
         <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Gerador de Cartelas em PDF</label>
         <input 
            type="number" 
            min="1" max="1000"
            className="w-full bg-[#0b0c10] border border-slate-700 rounded-lg px-4 py-2.5 text-white"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 1)}
         />
       </div>
       <button 
          onClick={handlePrint}
          disabled={printing}
          className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-6 py-2.5 font-bold transition-all flex items-center gap-2 w-full sm:w-auto justify-center disabled:opacity-50"
       >
         <Printer size={20} />
         {printing ? 'Gerando...' : 'Gerar e Imprimir'}
       </button>
    </div>
  );
}
