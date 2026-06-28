export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'APIキーが設定されていません' });
  }

  try {
    const { image1, mime1, image2, mime2, topic } = req.body;

    const prompt = (topic) => `あなたは英語ライティングの採点専門家です。画像内のライティングを読み取り、以下の評価項目で厳密に採点してください。
TOPIC: ${topic || '（未指定）'}

必ずこのJSONフォーマットのみで返答してください（前置きや説明は一切不要）:
{
  "structure": {
    "items": [
      {"key":"topic_aligned","label":"TOPICに沿っている","status":"OK","note":"..."},
      {"key":"point_aligned","label":"POINTに沿っている","status":"OK","note":"..."},
      {"key":"word_count","label":"文字数が過不足ない","status":"OK","note":"..."},
      {"key":"clear_message","label":"何が言いたいか伝わる","status":"OK","note":"..."},
      {"key":"no_duplicate","label":"重複がない","status":"OK","note":"..."},
      {"key":"not_absolute","label":"言い切りすぎていない","status":"OK","note":"..."},
      {"key":"template_used","label":"テンプレを使えている","status":"OK","note":"..."},
      {"key":"flow","label":"流れに沿っている","status":"OK","note":"..."},
      {"key":"connectives","label":"接続詞が使えている","status":"OK","note":"..."},
      {"key":"sentence_length","label":"文の長さが適切","status":"OK","note":"..."}
    ],
    "score": 4,
    "max": 4,
    "comment": "..."
  },
  "vocabulary": {
    "items": [
      {"key":"spelling","label":"スペルミスがない","status":"OK","note":"..."},
      {"key":"capitalization","label":"大文字・小文字が使えている","status":"OK","note":"..."},
      {"key":"no_repeat","label":"繰り返しの単語がない","status":"OK","note":"..."},
      {"key":"advanced_vocab","label":"簡単な単語ばかりでない","status":"OK","note":"..."},
      {"key":"generalize","label":"一般化できている(people,they等)","status":"OK","note":"..."},
      {"key":"no_contraction","label":"省略系を使っていない(don't等)","status":"OK","note":"..."}
    ],
    "score": 6,
    "max": 6,
    "comment": "..."
  },
  "grammar": {
    "items": [
      {"key":"subject","label":"Sがある（主語）","status":"OK","note":"..."},
      {"key":"verb","label":"Vがある（動詞）","status":"OK","note":"..."},
      {"key":"object","label":"Oがある（目的語）","status":"OK","note":"..."},
      {"key":"singular_plural","label":"単数・複数が使えている","status":"OK","note":"..."},
      {"key":"third_person_s","label":"三単現のsが使えている","status":"OK","note":"..."},
      {"key":"tense","label":"時制が使えている","status":"OK","note":"..."},
      {"key":"parts_of_speech","label":"品詞が使い分けられている","status":"OK","note":"..."},
      {"key":"preposition","label":"前置詞が使えている","status":"OK","note":"..."},
      {"key":"article","label":"冠詞が使えている","status":"OK","note":"..."},
      {"key":"comma","label":"カンマが使えている","status":"OK","note":"..."}
    ],
    "score": 10,
    "max": 10,
    "comment": "..."
  },
  "content": {"score": 6,"max": 6,"comment": "..."},
  "total": {"score": 26,"max": 26,"overall_comment": "..."}
}
statusの値は必ず "OK", "NG", "WARN" のいずれかにしてください。scoreは実際の評価に基づいた整数にしてください。`;

    const callGemini = async (b64, mime, topic) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ parts: [
          { inline_data: { mime_type: mime, data: b64 } },
          { text: prompt(topic) }
        ]}],
        generationConfig: { temperature: 0.1 }
      };
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error?.message || 'Gemini APIエラー');
      }
      const d = await r.json();
      return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    };

    const [raw1, raw2] = await Promise.all([
      callGemini(image1, mime1, topic),
      callGemini(image2, mime2, topic)
    ]);

    const parse = (raw) => {
      const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    };

    res.status(200).json({
      entry: parse(raw1),
      recent: parse(raw2)
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
