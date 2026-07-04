import { useState, useEffect } from 'react';

function Chat({ ws, isDrawer }) {
  const [messages, setMessages] = useState<{ text: string; correct: boolean }[]>([]);
  const [guessInput, setGuessInput] = useState('');

  useEffect(() => {
    function handleMessage(event) {
      const data = JSON.parse(event.data);

      if (data.type === 'guess_result' && data.correct) {
        setMessages((prev) => [
          ...prev,
          { text: data.playerName + ' guess the word', correct: true }
        ]);
      }

      if (data.type === 'chat_message') {
        setMessages((prev) => [
          ...prev,
          { text: data.playerName + ': ' + data.text, correct: false }
        ]);
      }
    }

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

  function sendGuess() {
    if (!guessInput.trim()) return;
    ws.send(JSON.stringify({ type: 'guess', text: guessInput }));
    setGuessInput('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') sendGuess();
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 w-64">
      <div className="h-96 overflow-y-auto border border-gray-200 rounded p-2 mb-2">
        {messages.map((m, i) => (
          <p key={i} className={`text-sm mb-1 ${m.correct ? 'text-green-600 font-bold' : 'text-gray-800'}`}>
            {m.text}
          </p>
        ))}
      </div>

      {!isDrawer && (
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
            value={guessInput}
            onChange={(e) => setGuessInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Guess the word"
          />
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
            onClick={sendGuess}
          >
            send
          </button>
        </div>
      )}
    </div>
  );
}

export default Chat;