from app.services.analyzer import analyze, extract_skills, semantic_similarity


def test_extracts_skills_in_order_of_mention():
    assert extract_skills("Built REST APIs with FastAPI and Python, deployed on Docker") == [
        "REST APIs", "FastAPI", "Python", "Docker",
    ]


def test_extracts_skills_with_symbols():
    assert extract_skills("C++, C#, .NET and Node.js") == ["C++", "C#", ".NET", "Node.js"]


def test_does_not_match_inside_other_words():
    skills = extract_skills("PostgreSQL and NoSQL stores, plus some JavaScript")
    assert skills == ["PostgreSQL", "JavaScript"]


def test_aliases_map_to_one_skill():
    assert extract_skills("k8s and Kubernetes, sklearn") == ["Kubernetes", "scikit-learn"]


def test_ambiguous_words_need_exact_case():
    assert extract_skills("ready to go and excel at a swift pace") == []
    assert extract_skills("Services written in Go, reports in Excel") == ["Go", "Excel"]


def test_skill_at_end_of_sentence_matches():
    assert extract_skills("Five years of Python.") == ["Python"]


def test_semantic_similarity_range():
    assert semantic_similarity("python developer", "python developer") == 100.0
    assert semantic_similarity("python developer", "florist arranging bouquets") == 0.0


def test_analyze_scores_and_skills():
    result = analyze(
        "Backend developer: Python, FastAPI, PostgreSQL",
        "We need Python, FastAPI, Kubernetes and PostgreSQL experience",
    )
    assert result.matched_skills == ["Python", "FastAPI", "PostgreSQL"]
    assert result.missing_skills == ["Kubernetes"]
    assert result.skill_score == 75.0
    assert result.overall_score == round(0.5 * result.semantic_score + 0.5 * 75.0, 1)
    assert any("Kubernetes" in r for r in result.recommendations)


def test_analyze_all_skills_matched():
    result = analyze("Python and Docker", "Python and Docker")
    assert result.missing_skills == []
    assert result.overall_score == 100.0
    assert result.recommendations == ["Your resume mentions every skill the job description asks for."]


def test_analyze_limits_skill_recommendations():
    job = "Java, Go, Rust, Ruby, PHP, Kotlin, Scala"
    result = analyze("Python developer", job)
    assert len(result.missing_skills) == 7
    skill_recs = [r for r in result.recommendations if r.startswith("The job asks for")]
    assert len(skill_recs) == 5
    assert any(r.startswith("2 more required skills") for r in result.recommendations)


def test_analyze_without_skills_in_job_description():
    result = analyze("I like people", "Friendly person wanted")
    assert result.skill_score == 0.0
    assert result.overall_score == result.semantic_score
    assert "similarity alone" in result.recommendations[0]
