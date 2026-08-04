/**
 * print.js
 * Extracts card data from the main system and generates an exact replica of the UI for A4 printing
 * Uses a hidden iframe to prevent flashing/opening new tabs.
 */

function printCards() {
  // 1. Gather all cards currently visible in the DOM
  const cards = document.querySelectorAll('.card-ui-wrapper');
  
  if (cards.length === 0) {
    alert("No cards available to print!");
    return;
  }

  // 2. Gumawa ng Hidden Iframe kung wala pa
  let printFrame = document.getElementById('hidden-print-frame');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'hidden-print-frame';
    // Itago ang iframe sa labas ng screen para hindi makita ng user
    printFrame.style.position = 'absolute';
    printFrame.style.top = '-10000px';
    printFrame.style.left = '-10000px';
    printFrame.style.width = '210mm'; 
    printFrame.style.height = '297mm';
    document.body.appendChild(printFrame);
  }

  // 3. Build the Print HTML Structure & CSS
  let html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Print CNSC Property Cards</title>
    <style>
      @page { 
        size: A4 portrait; 
        margin: 5mm; 
      }
      body { 
        margin: 0; 
        font-family: Arial, Helvetica, sans-serif; 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
        background: white;
      }
      .page-wrapper {
        display: grid;
        grid-template-columns: repeat(2, 92mm); 
        grid-template-rows: repeat(5, 53mm);    
        gap: 3mm 8mm; 
        justify-content: center; 
        align-content: start; 
        page-break-after: always;
        box-sizing: border-box;
      }
      .label-container {
        width: 100%;
        height: 100%;
        background-color: #faf9f5;
        border: 1.5px solid #000;
        box-sizing: border-box;
        position: relative;
        display: flex;
        flex-direction: column;
        page-break-inside: avoid;
      }
      .top-white-space {
        height: 6px; 
        background-color: transparent;
      }
      .color-banner {
        height: 25px;
        display: flex;
        justify-content: center;
        align-items: center;
        border-top: 1.5px solid #000;
        border-bottom: 2px solid #333;
        position: relative;
      }
      .color-banner h1 {
        margin: 0;
        font-family: "Arial Black", Arial, sans-serif;
        font-size: 13px; 
        letter-spacing: 1px;
        color: #4a4a4a;
        -webkit-text-stroke: 0.5px #000;
        text-shadow: 
          0.5px 0.5px 0 #fff, 
         -0.5px -0.5px 0 #fff, 
          0.5px -0.5px 0 #fff, 
         -0.5px 0.5px 0 #fff,
          0px 1px 2px rgba(0,0,0,0.6);
        transform: scaleX(1.15); 
      }
      .logo-shield {
        position: absolute;
        /* Further reduced logo size per request */
        top: -6px;
        right: 14px;
        width: 36px;
        height: 36px;
        z-index: 10;
      }
      .logo-shield img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .form-section {
        padding: 2px 12px 4px 12px;
        display: flex;
        flex-direction: column;
        justify-content: space-evenly; 
        flex-grow: 1;
      }
      .form-row {
        display: flex;
        align-items: flex-end; 
      }
      .form-row label {
        font-size: 8px;
        color: #3b3b3b;
        white-space: nowrap;
        padding-bottom: 1px;
      }
      .form-row .value {
        flex-grow: 1;
        border-bottom: 1px solid #333;
        margin-left: 4px;
        font-size: 8px;
        color: #000;
        min-height: 10px;
        padding-bottom: 1px;
        
        white-space: pre-wrap; 
        word-break: break-word;
        line-height: 1.1; 
        max-height: 18px; 
        overflow: hidden;
        
        font-family: Arial, Helvetica, sans-serif;
      }
    </style>
  </head>
  <body>
  `;

  // 4. Loop through cards and inject them in chunks of 10 per page
  let cardIndex = 0;
  
  while (cardIndex < cards.length) {
    html += `<div class="page-wrapper">`;
    
    for (let i = 0; i < 10; i++) {
      if (cardIndex >= cards.length) break;
      
      const card = cards[cardIndex];
      const bannerColor = card.querySelector('.color-banner').style.backgroundColor;
      const inputs = card.querySelectorAll('.underline-input');
      
      // Extract values from the inputs/textareas
      const icsParNo = inputs[0].value || '';
      const propertyNo = inputs[1].value || '';
      const description = inputs[2].value || '';
      const requestedBy = inputs[3].value || '';
      const endUser = inputs[4].value || '';
      const supplier = inputs[5].value || '';
      const fund = inputs[6].value || '';
      const dateAcquired = inputs[7].value || '';
      const acqCost = inputs[8].value || '';
      const refCode = inputs[9].value || '';

      html += `
        <div class="label-container">
          <div class="top-white-space"></div>
          <div class="color-banner" style="background-color: ${bannerColor};">
            <h1>CNSC PROPERTY</h1>
            <div class="logo-shield">
              <img src="logo.png" onerror="this.style.display='none'" alt="Logo">
            </div>
          </div>
          
          <div class="form-section">
            <div class="form-row"><label>ICS/PAR No.:</label><div class="value">${icsParNo}</div></div>
            <div class="form-row"><label>Property No.:</label><div class="value">${propertyNo}</div></div>
            <div class="form-row"><label>Item Description:</label><div class="value">${description}</div></div>
            <div class="form-row"><label>Requested by:</label><div class="value">${requestedBy}</div></div>
            <div class="form-row"><label>End-User/Location:</label><div class="value">${endUser}</div></div>
            <div class="form-row"><label>Supplier:</label><div class="value">${supplier}</div></div>
            <div class="form-row"><label>Fund:</label><div class="value">${fund}</div></div>
            <div class="form-row"><label>Date Aquired:</label><div class="value">${dateAcquired}</div></div>
            <div class="form-row"><label>Acquisition Cost:</label><div class="value">${acqCost}</div></div>
            <div class="form-row"><label>P.O/J.O/Contract Ref:</label><div class="value">${refCode}</div></div>
          </div>
        </div>
      `;
      cardIndex++;
    }
    
    html += `</div>`; // Close page-wrapper
  }

  // 5. Add print execution script for the iframe
  html += `
    <script>
      window.onload = function() {
        setTimeout(() => {
          window.focus();
          window.print();
        }, 300); 
      }
    </script>
  </body>
  </html>
  `;

  // 6. Write the HTML inside the Hidden Iframe
  const frameDoc = printFrame.contentWindow.document;
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();
}