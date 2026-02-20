// ─── PAGE NAVIGATION ───
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

// ─── CLAUSE SELECTION ───
function selectClause(el) {
  document.querySelectorAll('.clause-orig').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

// ─── Q&A: FILL SUGGESTED QUESTION ───
function fillQuestion(el) {
  document.getElementById('qa-input').value = el.textContent.trim();
  document.getElementById('qa-input').focus();
}

// ─── Q&A: SEND MESSAGE ───
function sendMessage() {
  const input = document.getElementById('qa-input');
  const q = input.value.trim();
  if (!q) return;

  const msgs = document.getElementById('qa-messages');

  // User bubble
  const userDiv = document.createElement('div');
  userDiv.className = 'msg-wrap user';
  userDiv.innerHTML = `
    <div class="msg-avatar user">👤</div>
    <div class="msg-bubble user">${q}</div>
  `;
  msgs.appendChild(userDiv);

  input.value = '';

  // Typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'msg-wrap';
  typingDiv.id = 'typing-indicator';
  typingDiv.innerHTML = `
    <div class="msg-avatar ai">AI</div>
    <div class="msg-bubble ai" style="color:var(--muted);font-style:italic;">Analyzing document…</div>
  `;
  msgs.appendChild(typingDiv);
  msgs.scrollTop = msgs.scrollHeight;

  // Simulate AI response (replace with real API call)
  setTimeout(() => {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();

    const aiDiv = document.createElement('div');
    aiDiv.className = 'msg-wrap';
    aiDiv.innerHTML = `
      <div class="msg-avatar ai">AI</div>
      <div class="msg-bubble ai">
        <strong>Based on your document:</strong> This question relates to the clauses in your rental agreement. The AI will retrieve the relevant clause using RAG and provide an accurate answer here once connected to the backend.
        <div class="urdu-reply">آپ کے سوال کا جواب آپ کے دستاویز کی بنیاد پر یہاں اردو میں دیا جائے گا۔</div>
        <div class="related-clause">📎 Retrieved from your document via FAISS</div>
      </div>
    `;
    msgs.appendChild(aiDiv);
    msgs.scrollTop = msgs.scrollHeight;
  }, 1000);
}

// ─── Q&A: SEND ON ENTER (not Shift+Enter) ───
document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('qa-input');
  if (textarea) {
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // ─── DRAG & DROP ON UPLOAD ZONE ───
  const dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) {
        showPage('analysis');
        // TODO: Pass file to backend API
        console.log('File dropped:', file.name);
      }
    });
  }

  // ─── FILE INPUT TRIGGER ───
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        showPage('analysis');
        // TODO: Pass file to backend API
        console.log('File selected:', file.name);
      }
    });
  }
});

// Make functions global so onclick="" in HTML works
window.showPage = showPage;
window.selectClause = selectClause;
window.fillQuestion = fillQuestion;
window.sendMessage = sendMessage;
