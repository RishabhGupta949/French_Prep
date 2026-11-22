with open('C:\\FrenchPrep\\server\\src\\modules\\ai\\ai.service.ts', 'r') as f:
    content = f.read()

# Find the position after "  return reply;\n}"
idx = content.rfind('  return reply;\n}')
if idx >= 0:
    new_function = ''''

export async function getReviewExplanationFromNIM(
  exerciseId: string
): Promise<string> {
  // Fetch exercise details from Firestore to construct the prompt
  const db = getDb();
  const exerciseDoc = await db.collection('exercises').doc(exerciseId).get();

  if (!exerciseDoc.exists) {
    throw new NIMError(404, 'Exercise not found');
  }

  const exerciseData = exerciseDoc.data();

  // Fetch the student's latest incorrect answer from the review queue
  const reviewDoc = await db.collection('reviewQueue').doc(exerciseId).get();

  let studentAnswer = '';
  let correctAnswer = '';

  if (reviewDoc.exists) {
    const reviewData = reviewDoc.data();
    studentAnswer = reviewData.lastSubmittedAnswer || '';
    correctAnswer = exerciseData.answerKey || '';
  } else {
    // Fallback: fetch from attempt history
    const attemptsCol = db.collection('userAttempts');
    const attemptSnap = await attemptsCol
      .where('userId', '==', 'currentUserPlaceholder')
      .where('lessonId', '==', exerciseData.lessonId)
      .orderBy('startedAt', 'desc')
      .limit(1)
      .get();

    if (!attemptSnap.empty) {
      const latestAttempt = attemptSnap.docs[0];
      const answerSnap = await latestAttempt.ref.collection('answers').orderBy('createdAt', 'desc').limit(1).get();
      if (!answerSnap.empty) {
        studentAnswer = answerSnap.docs[0].data().answer || '';
      }
    }
    correctAnswer = exerciseData.answerKey || '';
  }

  // Build the NIM prompt
  const prompt = `You are an AI tutor helping a student learn French.

The student was asked: "${exerciseData.question}"

The student answered: "${studentAnswer}"

The correct answer is: "${correctAnswer}"

The student's answer was incorrect. Explain:
1. What the student actually answered
2. Why this answer was incorrect
3. One helpful hint or example to help the student remember the correct answer going forward

Be concise and educational. Do NOT invent or change the correct answer — treat the stored answer key as authoritative.

Explanation:

`;

  const response = await fetch(`${process.env.NVIDIA_NIM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.NVIDIA_NIM_MODEL || 'nvidia/nemotron',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new NIMError(
      response.status,
      errorData.message || 'Failed to get AI explanation'
    );
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (typeof reply !== 'string' || reply.length === 0) {
    throw new NIMError(502, 'Invalid response from the AI service.');
  }

  return reply;
}
'''
    content = content[:idx+1] + new_function + content[idx+1:]
    with open('C:\\FrenchPrep\\server\\src\\modules\\ai\\ai.service.ts', 'w') as f:
        f.write(content)
    print('Inserted getReviewExplanationFromNIM function')