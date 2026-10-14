import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from benchmark import bm25, chunk_token_ids, ndcg, recall, tokenize
import json


class RetrievalMetricsTests(unittest.TestCase):
    def test_ndcg_grade_two_first_is_one(self):
        self.assertEqual(ndcg([{"sourceId": "a", "grade": 2}, {"sourceId": "b", "grade": 1}], ["a", "b"]), 1.0)

    def test_inverse_relevance_order_scores_lower(self):
        gold = [{"sourceId": "a", "grade": 2}, {"sourceId": "b", "grade": 1}]
        self.assertLess(ndcg(gold, ["b", "a"]), 1.0)

    def test_empty_gold_is_not_a_perfect_score(self):
        self.assertIsNone(ndcg([], ["unrelated"]))
        self.assertIsNone(recall([], ["unrelated"]))

    def test_recall_uses_gold_denominator(self):
        gold = [{"sourceId": "a", "grade": 2}, {"sourceId": "b", "grade": 1}]
        self.assertEqual(recall(gold, ["a"]), 0.5)

    def test_bm25_retrieves_matching_text_and_is_deterministic(self):
        docs = [{"id": "a", "text": "manga no lanche da tarde"}, {"id": "b", "text": "feira local no domingo"}]
        first = bm25("manga lanche", docs)
        self.assertEqual(first, bm25("manga lanche", docs))
        self.assertEqual(first[0][0], "a")

    def test_normalization_preserves_numbers_but_ignores_accents(self):
        self.assertEqual(tokenize("Água 750 mL"), ["agua", "750", "ml"])

    def test_frozen_corpus_has_separate_partitions_and_synthetic_scope(self):
        root = Path(__file__).resolve().parents[1]
        corpus = json.loads((root / "corpus.json").read_text())
        self.assertTrue(corpus["syntheticOnly"])
        self.assertEqual(sum(q["partition"] == "dev" for q in corpus["queries"]), 10)
        self.assertEqual(sum(q["partition"] == "test" for q in corpus["queries"]), 30)
        self.assertTrue(all(d["synthetic"] for d in corpus["documents"]))
        self.assertTrue(any(d["tenant"] != "tenant-sim-1" for d in corpus["documents"]))

    def test_old_source_cases_are_after_first_fifty(self):
        root = Path(__file__).resolve().parents[1]
        corpus = json.loads((root / "corpus.json").read_text())
        by_id = {d["id"]: d for d in corpus["documents"]}
        old_cases = [q for q in corpus["queries"] if q["category"] == "fonte-antiga"]
        self.assertTrue(old_cases)
        self.assertTrue(all(by_id[q["gold"][0]["sourceId"]]["ordinal"] > 50 for q in old_cases))
        chronological = sorted((d for d in corpus["documents"] if d["tenant"] == "tenant-sim-1"),
                               key=lambda d: (d["created"], d["id"]))
        first_fifty = {d["id"] for d in chronological[:50]}
        self.assertTrue(all(q["gold"][0]["sourceId"] not in first_fifty for q in old_cases))

    def test_chunking_covers_all_tokens_with_fixed_overlap(self):
        ids = list(range(200))
        chunks = chunk_token_ids(ids)
        self.assertEqual(chunks[0], ids[:96])
        self.assertEqual(chunks[1][:24], chunks[0][-24:])
        self.assertEqual(chunks[-1][-1], ids[-1])

    def test_chunking_rejects_invalid_overlap(self):
        with self.assertRaises(ValueError):
            chunk_token_ids([1, 2], size=3, overlap=3)


if __name__ == "__main__":
    unittest.main()
