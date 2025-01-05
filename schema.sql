-- 단어장 테이블
CREATE TABLE vocabulary_lists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 단어 테이블
CREATE TABLE vocabulary_words (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id UUID REFERENCES vocabulary_lists(id) ON DELETE CASCADE,
    word VARCHAR(255) NOT NULL,
    part_of_speech VARCHAR(50), -- 품사
    meaning TEXT NOT NULL,
    example TEXT,
    example_translation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 시험 기록 테이블
CREATE TABLE quiz_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id UUID REFERENCES vocabulary_lists(id),
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 시험 상세 기록 테이블
CREATE TABLE quiz_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID REFERENCES quiz_history(id) ON DELETE CASCADE,
    word_id UUID REFERENCES vocabulary_words(id),
    user_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- updated_at을 자동으로 업데이트하는 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vocabulary_lists_updated_at
    BEFORE UPDATE ON vocabulary_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 