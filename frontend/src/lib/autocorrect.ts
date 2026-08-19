// Autocorrect and fuzzy topic matching utility for EduSphere

export interface TopicSuggestion {
  keywords: string[];
  corrected: string;
  label: string;
}

export const TOPIC_CORRECTIONS: TopicSuggestion[] = [
  { keywords: ["python", "pythn", "pyton", "pyhton", "pthon", "py", "pythoon", "puython"], corrected: "Python Programming & Data Science", label: "Python Programming" },
  { keywords: ["react", "reactjs", "reakt", "reat", "react.js", "rect js", "react js"], corrected: "React & Modern Frontend Web Development", label: "React Web Development" },
  { keywords: ["javascript", "js", "javscript", "javascrip", "jvscript", "jscript", "java script", "javascrpt"], corrected: "JavaScript & Modern Web Apps", label: "JavaScript" },
  { keywords: ["machine learning", "ml", "machin lerning", "machinlearning", "machne learning", "machin learn", "machien learning"], corrected: "Machine Learning & Neural Networks", label: "Machine Learning & AI" },
  { keywords: ["artificial intelligence", "ai", "artifical inteligence", "artifical intelligence", "artifitial intelligence", "artficial intelligence"], corrected: "Artificial Intelligence & Deep Learning", label: "Artificial Intelligence" },
  { keywords: ["data science", "data scince", "datascience", "data scienc", "data analitics", "data analytics", "data scence"], corrected: "Data Science & Python Analysis", label: "Data Science" },
  { keywords: ["data structures", "dsa", "data structure", "data structres", "datastructures", "algorithms", "algoritm", "algortihm", "algo", "algotithms", "algos"], corrected: "Data Structures & Algorithms in Python / C++", label: "Data Structures & Algorithms" },
  { keywords: ["dbms", "sql", "sqll", "database", "data base", "databse", "postgresql", "mysql", "sql joins", "sql queries", "sqldb"], corrected: "Database Management Systems (DBMS) & SQL", label: "DBMS & SQL Joins" },
  { keywords: ["cyber security", "cybersecurity", "cuber security", "ciber security", "ethical hacking", "hacking", "cyber sec", "cybersec"], corrected: "Cyber Security Fundamentals & Ethical Hacking", label: "Cyber Security" },
  { keywords: ["cloud", "cloud computing", "aws", "azure", "devops", "docker", "dockr", "kubernetes", "kubernets", "kubernetis", "cloud compute"], corrected: "Cloud Computing & DevOps Architecture", label: "Cloud & DevOps" },
  { keywords: ["web development", "web dev", "webdev", "frontend", "front end", "full stack", "fullstack", "web design", "html css", "webdevelopmnt"], corrected: "Full-Stack Web Development (HTML, CSS, JavaScript, React)", label: "Web Development" },
  { keywords: ["node", "nodejs", "node js", "express", "backend", "back end", "backend dev", "node.js"], corrected: "Node.js & Express Backend Development", label: "Node.js Backend" },
  { keywords: ["java", "jva", "spring boot", "springboot", "core java", "java dev"], corrected: "Java Programming & Spring Boot Development", label: "Java Development" },
  { keywords: ["c++", "cpp", "c plus plus", "c programming", "cplusplus"], corrected: "C++ Object-Oriented Programming & Systems", label: "C++ Programming" },
  { keywords: ["blockchain", "block chain", "crypto", "solidity", "web3", "smart contracts", "blockchian"], corrected: "Blockchain & Web3 Smart Contract Development", label: "Blockchain & Web3" },
  { keywords: ["flutter", "react native", "android", "ios", "mobile app", "mobil app", "app dev", "mobile dev"], corrected: "Mobile App Development with Flutter & React Native", label: "Mobile App Development" },
];

function levenshtein(a: string, b: string): number {
  const an = a.length, bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) matrix[i] = [i];
  for (let j = 0; j <= an; j++) matrix[0][j] = j;
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}

export function getAutocorrectSuggestion(input: string): { original: string; corrected: string; label: string } | null {
  const clean = input.trim().toLowerCase();
  if (clean.length < 2) return null;

  for (const item of TOPIC_CORRECTIONS) {
    if (item.keywords.includes(clean)) {
      if (clean !== item.label.toLowerCase() && clean !== item.corrected.toLowerCase()) {
        return { original: input, corrected: item.corrected, label: item.label };
      }
    }
  }

  let bestMatch: { item: TopicSuggestion; dist: number } | null = null;
  const words = clean.split(/\s+/);

  for (const item of TOPIC_CORRECTIONS) {
    for (const kw of item.keywords) {
      if (clean.length >= 3 && kw.startsWith(clean) && clean !== kw) {
        return { original: input, corrected: item.corrected, label: item.label };
      }

      if (clean.includes(kw)) {
         return { original: input, corrected: item.corrected, label: item.label };
      }

      const distWhole = levenshtein(clean, kw);
      const maxAllowedWhole = kw.length <= 4 ? 1 : kw.length <= 8 ? 2 : 3;
      if (distWhole > 0 && distWhole <= maxAllowedWhole) {
        if (!bestMatch || distWhole < bestMatch.dist) {
          bestMatch = { item, dist: distWhole };
        }
      }

      const kwTokens = kw.split(/\s+/);
      const n = kwTokens.length;
      if (words.length >= n) {
        for (let i = 0; i <= words.length - n; i++) {
          const ngram = words.slice(i, i + n).join(" ");
          const distNgram = levenshtein(ngram, kw);
          const maxAllowedNgram = kw.length <= 4 ? 1 : kw.length <= 8 ? 2 : 3;
          if (distNgram <= maxAllowedNgram) {
             if (!bestMatch || distNgram < bestMatch.dist) {
               bestMatch = { item, dist: distNgram };
             }
          }
        }
      }
    }
  }

  if (bestMatch) {
    return { original: input, corrected: bestMatch.item.corrected, label: bestMatch.item.label };
  }

  return null;
}
