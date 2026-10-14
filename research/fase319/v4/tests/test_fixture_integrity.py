import hashlib
import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT.parent
CORPUS_BYTES = (ROOT / "corpus.json").read_bytes()
CORPUS = json.loads(CORPUS_BYTES)
PROTOCOL = json.loads((ROOT / "protocolo.json").read_text())
V3_PROTOCOL = json.loads((LAB / "protocolo.json").read_text())


class Version4FixtureTests(unittest.TestCase):
    def test_corpus_hash_and_frozen_cuts(self):
        self.assertEqual(hashlib.sha256(CORPUS_BYTES).hexdigest(), PROTOCOL["corpusSha256"])
        self.assertEqual(PROTOCOL["criteriosCongelados"], V3_PROTOCOL["criteriosCongelados"])
        self.assertEqual(PROTOCOL["versao"], 4)
        self.assertEqual(CORPUS["syntheticOnly"], True)

    def test_partition_and_gold_structure(self):
        test_queries = [q for q in CORPUS["queries"] if q["partition"] == "test"]
        self.assertEqual(len(CORPUS["queries"]), 40)
        self.assertEqual(len(test_queries), 30)
        self.assertEqual(sum(q["answerable"] for q in test_queries), 25)
        docs = {d["id"]: d for d in CORPUS["documents"]}
        for q in test_queries:
            if q["answerable"]:
                self.assertTrue(q["gold"], q["id"])
                for gold in q["gold"]:
                    doc = docs[gold["sourceId"]]
                    self.assertEqual(doc["tenant"], "tenant-sim-1")
                    self.assertEqual(doc["patient"], "patient-sim-1")
            else:
                self.assertEqual(q["gold"], [], q["id"])

    def test_corrected_questions_match_their_sources(self):
        queries = {q["id"]: q for q in CORPUS["queries"]}
        expected = {
            "q-016": "sem afirmar causalidade",
            "q-019": "capacidade, em mililitros",
            "q-021": "Para qual data",
            "q-023": "tomado como referência",
            "q-027": "nota antiga",
            "q-029": "nota menciona",
            "q-033": "no período da tarde",
        }
        for qid, phrase in expected.items():
            self.assertIn(phrase.casefold(), queries[qid]["query"].casefold())

    def test_no_answer_topics_have_no_lexical_source_in_eligible_corpus(self):
        eligible = [d["text"].casefold() for d in CORPUS["documents"]
                    if d["tenant"] == "tenant-sim-1" and d["patient"] == "patient-sim-1"]
        forbidden_terms = ("tofu", "soja", "zinco", "suplemento", "neve", "esqui", "ski",
                           "kiwi", "alergia", "pitaya", "fruta do dragão")
        corpus_text = "\n".join(eligible)
        for term in forbidden_terms:
            self.assertIsNone(re.search(rf"\b{re.escape(term)}\b", corpus_text), term)


if __name__ == "__main__":
    unittest.main()
