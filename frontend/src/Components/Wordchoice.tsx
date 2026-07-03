import { useState, useEffect } from 'react';

function WordChoice({ ws, words }: { ws: WebSocket; words: string[] }) {
  const [localWords, setLocalWords] = useState<string[]>(words);

  useEffect(() => {
    if (words.length > 0) {
      setLocalWords(words);
    }
  }, [words]);

  function pickWord(word: string) {
    ws.send(JSON.stringify({ type: 'word_chosen', word: word }));
    setLocalWords([]);
  }

  if (localWords.length === 0) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h3 className="text-xl font-bold mb-4">Word chun:</h3>
        <div className="flex gap-3">
          {localWords.map((w, i) => (
            <button
              key={i}
              className="bg-purple-500 hover:bg-purple-600 text-white px-5 py-2 rounded"
              onClick={() => pickWord(w)}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WordChoice;