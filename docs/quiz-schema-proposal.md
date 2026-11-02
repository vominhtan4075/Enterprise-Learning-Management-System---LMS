// 1. Thông tin bài kiểm tra (Quiz)
model Quiz {
  id                 String         @id @default(uuid())
  courseId           String?        // Khóa ngoại liên kết với Khóa học
  moduleId           String?        // Khóa ngoại liên kết với Học phần
  title              String
  description        String?
  quizType           QuizType       @default(MODULE_QUIZ) // MODULE_QUIZ hoặc FINAL_EXAM
  passingScore       Float          @default(70.0)        // BR-01: Điểm đạt >= 70%
  timeLimitMinutes   Int            @default(30)
  maxAttempts        Int            @default(3)
  questions          Question[]
  attempts           QuizAttempt[]
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt
}

enum QuizType {
  MODULE_QUIZ
  FINAL_EXAM
}

// 2. Ngân hàng câu hỏi (Question)
model Question {
  id                 String       @id @default(uuid())
  quizId             String
  quiz               Quiz         @relation(fields: [quizId], references: [id], onDelete: Cascade)
  questionText       String
  questionType       QuestionType @default(MCQ)
  options            Json         // Dạng JSONB: [{ "key": "A", "text": "..." }, ...]
  correctAnswer      String       // Ví dụ: "B"
  explanation        String?      // Giải thích đáp án đúng
  relatedLessonId    String?      // ID bài học tương ứng dùng để gợi ý ôn tập (BR-03)
  relatedLessonTopic String?      // Tên chủ đề kiến thức (ví dụ: "Spring Bean Lifecycle")
}

enum QuestionType {
  MCQ           // Trắc nghiệm nhiều lựa chọn
  SINGLE_CHOICE // Chọn 1 đáp án đúng
}

// 3. Lịch sử làm bài thi (QuizAttempt)
model QuizAttempt {
  id                 String        @id @default(uuid())
  quizId             String
  quiz               Quiz          @relation(fields: [quizId], references: [id])
  userId             String        // ID Học viên
  scorePercentage    Float         // Tỷ lệ % điểm đạt được
  isPassed           Boolean       @default(false) // True nếu scorePercentage >= passingScore
  attemptNumber      Int           @default(1)     // Lượt thi thứ mấy (BR-03)
  status             AttemptStatus @default(COMPLETED)
  userAnswers        Json          // Dạng JSONB: [{ "questionId": "...", "selectedOption": "A" }]
  startedAt          DateTime      @default(now())
  completedAt        DateTime?
}

enum AttemptStatus {
  IN_PROGRESS
  COMPLETED
  TIMED_OUT
}