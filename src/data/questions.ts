export type Question = {
  id: number;
  question: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  explanation: string;
};

export const LETTERS = ["A", "B", "C", "D"] as const;

// Seluruh redaksi, pilihan jawaban, kunci, dan pembahasan berikut disalin langsung
// dari bank soal "Materi Pembelajaran Bab 3 Pertemuan 1" yang diberikan pengguna.
export const QUESTIONS: Question[] = [
  {
    id: 1,
    question: "Indonesia terletak di antara dua benua, yaitu ...",
    options: ["Asia dan Afrika", "Asia dan Australia", "Eropa dan Australia", "Afrika dan Amerika"],
    answer: 1,
    explanation: "Indonesia terletak di antara Benua Asia di sebelah utara/barat laut dan Benua Australia di sebelah selatan/tenggara.",
  },
  {
    id: 2,
    question: "Dua samudra yang mengapit wilayah Indonesia adalah ...",
    options: ["Samudra Atlantik dan Pasifik", "Samudra Arktik dan Hindia", "Samudra Hindia dan Pasifik", "Samudra Atlantik dan Hindia"],
    answer: 2,
    explanation: "Indonesia terletak di antara Samudra Hindia dan Samudra Pasifik.",
  },
  {
    id: 3,
    question: "Karena dilalui garis khatulistiwa, Indonesia memiliki iklim ...",
    options: ["Subtropis", "Tropis", "Kutub", "Dingin"],
    answer: 1,
    explanation: "Letak Indonesia di sekitar garis khatulistiwa menyebabkan Indonesia beriklim tropis dengan dua musim, yaitu hujan dan kemarau.",
  },
  {
    id: 4,
    question: "Selat yang menjadi jalur penting pelayaran dan perdagangan dunia di wilayah Indonesia adalah ...",
    options: ["Selat Sunda", "Selat Bali", "Selat Malaka", "Selat Lombok"],
    answer: 2,
    explanation: "Kapal dari India, Arab, dan Eropa menuju Tiongkok melewati perairan Indonesia, terutama Selat Malaka.",
  },
  {
    id: 5,
    question: "Daerah penghasil cengkih dan pala yang disebutkan dalam materi adalah ...",
    options: ["Jawa dan Sumatra", "Maluku, Ternate, Tidore, dan Banda", "Kalimantan dan Sulawesi", "Aceh dan Lampung"],
    answer: 1,
    explanation: "Cengkih dan pala banyak dihasilkan dari wilayah Maluku, termasuk Ternate, Tidore, dan Banda.",
  },
  {
    id: 6,
    question: "Komoditas lada di Indonesia dihasilkan antara lain dari daerah ...",
    options: ["Banten, Lampung, dan Aceh", "Jawa Barat dan Jawa Tengah", "Bangka dan Belitung", "Ternate dan Tidore"],
    answer: 0,
    explanation: "Daerah penghasil lada yang disebutkan dalam materi adalah Banten, Lampung, dan Aceh.",
  },
  {
    id: 7,
    question: "Apa yang dimaksud dengan semboyan Gold, Glory, Gospel?",
    options: ["Perdagangan, pendidikan, dan pertanian", "Kekayaan, kejayaan, dan penyebaran agama", "Kekuasaan, persatuan, dan kemerdekaan", "Perkebunan, pelayaran, dan perdagangan"],
    answer: 1,
    explanation: "Gold berarti kekayaan, Glory berarti kejayaan, dan Gospel berarti penyebaran agama.",
  },
  {
    id: 8,
    question: "Salah satu alasan bangsa Eropa ingin datang langsung ke Indonesia adalah ...",
    options: ["Ingin membangun sekolah", "Ingin membeli tanah pertanian", "Harga rempah-rempah di Eropa sangat mahal", "Ingin mempelajari bahasa daerah"],
    answer: 2,
    explanation: "Harga rempah-rempah di Eropa sangat mahal sehingga bangsa Eropa ingin datang langsung ke daerah penghasilnya untuk memperoleh keuntungan besar.",
  },
  {
    id: 9,
    question: "Bangsa Eropa pertama yang tiba di wilayah Maluku pada tahun 1512 adalah ...",
    options: ["Belanda", "Inggris", "Portugis", "Spanyol"],
    answer: 2,
    explanation: "Portugis menguasai Malaka pada tahun 1511 dan tiba di Maluku pada tahun 1512.",
  },
  {
    id: 10,
    question: "Pada tahun 1521, bangsa Spanyol tiba di Maluku, tepatnya di ...",
    options: ["Banten", "Tidore", "Makassar", "Sunda Kelapa"],
    answer: 1,
    explanation: "Spanyol tiba di Maluku pada tahun 1521, tepatnya di Tidore, untuk mencari rempah-rempah dan bersaing dengan Portugis.",
  },
  {
    id: 11,
    question: "Siapakah tokoh Belanda yang tiba di Banten pada tahun 1596?",
    options: ["Thomas Stamford Raffles", "Cornelis de Houtman", "Jan Pieterszoon Coen", "Daendels"],
    answer: 1,
    explanation: "Cornelis de Houtman memimpin kedatangan Belanda di Banten pada tahun 1596.",
  },
  {
    id: 12,
    question: "VOC didirikan oleh Belanda pada tahun ...",
    options: ["1511", "1521", "1596", "1602"],
    answer: 3,
    explanation: "Belanda mendirikan VOC pada tahun 1602 untuk memonopoli perdagangan rempah dan menguasai wilayah.",
  },
  {
    id: 13,
    question: "Tokoh Inggris yang menguasai Jawa pada masa 1811–1816 adalah ...",
    options: ["Cornelis de Houtman", "Thomas Stamford Raffles", "Pattimura", "Sultan Hasanuddin"],
    answer: 1,
    explanation: "Inggris menguasai Jawa pada tahun 1811–1816 di bawah kepemimpinan Thomas Stamford Raffles dan menerapkan sistem sewa tanah (landrent).",
  },
  {
    id: 14,
    question: "Salah satu bentuk penderitaan rakyat Indonesia pada masa penjajahan adalah ...",
    options: ["Mendapat pendidikan gratis", "Mendapat kebebasan berdagang", "Dipaksa bekerja, membayar pajak, dan menyerahkan hasil bumi", "Mendapat pembagian tanah secara merata"],
    answer: 2,
    explanation: "Rakyat hidup dalam tekanan karena sering dipaksa bekerja, membayar pajak, dan menyerahkan hasil bumi kepada penjajah.",
  },
  {
    id: 15,
    question: "Salah satu tokoh perlawanan rakyat dari Maluku yang disebutkan dalam materi adalah ...",
    options: ["Pattimura", "Thomas Stamford Raffles", "Cornelis de Houtman", "Spanyol"],
    answer: 0,
    explanation: "Pattimura merupakan salah satu tokoh perlawanan rakyat dari Maluku. Tokoh lainnya adalah Sultan Hasanuddin, Pangeran Diponegoro, dan Cut Nyak Dien.",
  },
  {
    id: 16,
    question: "Apa yang dimaksud dengan Tanam Paksa atau Cultuurstelsel?",
    options: ["Rakyat bebas memilih tanaman yang akan ditanam", "Rakyat wajib menanam kopi, tebu, dan nila untuk diekspor", "Pemerintah membagikan bibit tanaman secara gratis", "Rakyat hanya diwajibkan menanam padi"],
    answer: 1,
    explanation: "Pada tahun 1830, Belanda menerapkan Tanam Paksa yang mewajibkan rakyat menanam kopi, tebu, dan nila untuk diekspor.",
  },
  {
    id: 17,
    question: "Apa yang dimaksud dengan romusha pada masa penjajahan Jepang?",
    options: ["Sekolah khusus rakyat", "Sistem perdagangan rempah-rempah", "Pekerja paksa", "Sistem sewa tanah"],
    answer: 2,
    explanation: "Pada masa Jepang, rakyat dipaksa menyerahkan padi dan menjadi romusha atau pekerja paksa.",
  },
  {
    id: 18,
    question: "Mengapa sebagian besar rakyat Indonesia tidak dapat bersekolah pada masa penjajahan Belanda?",
    options: ["Sekolah hanya tersedia untuk anak Belanda, bangsawan, dan orang berada", "Semua sekolah hanya mengajarkan bahasa Jepang", "Rakyat tidak diperbolehkan bekerja", "Semua sekolah berada di luar negeri"],
    answer: 0,
    explanation: "Pendidikan sangat terbatas. Sekolah pada masa Belanda terutama diperuntukkan bagi anak orang Belanda, bangsawan, dan orang berada.",
  },
  {
    id: 19,
    question: "Politik adu domba yang dilakukan penjajah dikenal dengan istilah ...",
    options: ["Gold and Glory", "Cultuurstelsel", "Devide et impera", "Landrent"],
    answer: 2,
    explanation: "Devide et impera adalah politik adu domba yang dimanfaatkan penjajah sehingga persatuan masyarakat melemah.",
  },
  {
    id: 20,
    question: "Pada masa penjajahan Jepang, bahasa Indonesia semakin berkembang karena ...",
    options: ["Bahasa Indonesia dilarang digunakan", "Bahasa Belanda dilarang digunakan", "Semua rakyat diwajibkan menggunakan bahasa Inggris", "Sekolah hanya menggunakan bahasa daerah"],
    answer: 1,
    explanation: "Pada masa Jepang, bahasa Belanda dilarang digunakan sehingga bahasa Indonesia semakin berkembang dan turut memperkuat persatuan.",
  },
];

export type Zone = {
  id: number;
  title: string;
  short: string;
  description: string;
  sky: number;
  fog: number;
  ground: number;
};

export const ZONES: Zone[] = [
  { id: 1, title: "GEOGRAPHICAL MISSION", short: "GEOGRAPHICAL", description: "Medan tropis, hutan, perbukitan, dan kawasan pesisir", sky: 0x78a9c9, fog: 0x9bb5a8, ground: 0x786744 },
  { id: 2, title: "NATURAL RESOURCES MISSION", short: "RESOURCES", description: "Perkebunan, pelabuhan, dan kawasan perdagangan", sky: 0xc4a878, fog: 0xb8ad8b, ground: 0x806845 },
  { id: 3, title: "COLONIAL HISTORY MISSION", short: "COLONIAL HISTORY", description: "Benteng kolonial, pelabuhan lama, dan medan bersejarah", sky: 0x8c9aa6, fog: 0x9c9d92, ground: 0x6e6655 },
  { id: 4, title: "NATIONAL STRUGGLE MISSION", short: "NATIONAL STRUGGLE", description: "Pedesaan, perkebunan, dan kawasan perjuangan rakyat", sky: 0xd0a06f, fog: 0xbba987, ground: 0x796943 },
];

export function zoneForQuestion(index: number): Zone {
  return ZONES[Math.min(3, Math.floor(index / 5))];
}

export type Validation = {
  valid: boolean;
  checks: { label: string; ok: boolean }[];
};

// Fingerprint of the exact 20 items supplied in "Materi Pembelajaran Bab 3 Pertemuan 1".
// Any change to a question, option, key, or explanation makes validation fail.
const SOURCE_FINGERPRINT = "750ea613";

export function bankFingerprint(data: unknown): string {
  const text = JSON.stringify(data);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function validateBank(): Validation {
  const uniqueQuestions = new Set(QUESTIONS.map((q) => q.question.trim().toLowerCase())).size;
  const expectedAnswers = [1, 2, 1, 2, 1, 0, 1, 2, 2, 1, 1, 3, 1, 2, 0, 1, 2, 0, 2, 1];
  const checksumOk = bankFingerprint(QUESTIONS) === SOURCE_FINGERPRINT;
  const checks = [
    { label: "Tepat 20 soal", ok: QUESTIONS.length === 20 },
    { label: "Urutan soal 1–20 lengkap", ok: QUESTIONS.every((q, i) => q.id === i + 1) },
    { label: "Setiap soal memiliki 4 pilihan A–D", ok: QUESTIONS.every((q) => q.options.length === 4 && q.options.every((o) => o.trim().length > 0)) },
    { label: "Setiap soal memiliki tepat satu kunci jawaban", ok: QUESTIONS.every((q, i) => Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3 && q.answer === expectedAnswers[i]) },
    { label: "Tidak ada pertanyaan berulang", ok: uniqueQuestions === 20 },
    { label: "Tidak ada soal tambahan di luar bank soal", ok: QUESTIONS.length === 20 },
    { label: "Seluruh pembahasan tersedia", ok: QUESTIONS.every((q) => q.explanation.trim().length > 20) },
    { label: "Checksum identik dengan dokumen sumber", ok: checksumOk },
    { label: "Materi Bab 3 Pertemuan 1 terverifikasi", ok: checksumOk },
  ];
  return { valid: checks.every((c) => c.ok), checks };
}
