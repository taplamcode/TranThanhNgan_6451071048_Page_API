const { GoogleGenAI } = require("@google/generative-ai");
const logger = require("../../../../shared/logger")("gemini-ai");

const apiKey = process.env.GEMINI_API_KEY || "";
let genAI = null;

if (apiKey) {
  try {
    genAI = new GoogleGenAI({ apiKey });
    logger.success("Gemini GenAI SDK initialized successfully.");
  } catch (err) {
    logger.error("Failed to initialize Google GenAI SDK:", err);
  }
} else {
  logger.warn("GEMINI_API_KEY is not defined. Resilient mock JSON classifier will be active.");
}

/**
 * Generates custom smart reply and intent/sentiment classification.
 * @param {string} userText 
 * @param {string} userName 
 * @param {"comment"|"message"} type 
 * @returns {Promise<{intent: string, sentiment: string, reply_message: string}>}
 */
async function classifyAndDraftReply(userText, userName = "bạn", type = "comment") {
  const cleanName = userName || "bạn";

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `
        Bạn là hệ thống AI phân tích phản hồi cho Facebook Page. 
        Hãy phân loại bình luận/tin nhắn sau đây từ khách hàng tên là "${cleanName}":
        Nội dung: "${userText}"
        Loại hình sự kiện: "${type}"

        Yêu cầu trả về chính xác định dạng JSON (không thêm markdown hay text nào khác bên ngoài) theo schema sau:
        {
          "intent": "phải là một trong: 'hỏi giá' | 'khiếu nại' | 'khen ngợi' | 'tương tác'",
          "sentiment": "phải là một trong: 'tích cực' | 'tiêu cực' | 'trung tính'",
          "reply_message": "Viết phản hồi ngắn gọn, lịch sự, bằng tiếng Việt và chèn icon phù hợp. Nếu intent là 'khiếu nại' hoặc sentiment là 'tiêu cực', hãy phản hồi xin lỗi lịch sự và hứa hỗ trợ qua inbox riêng."
        }
      `;
      
      const result = await model.generateContent(prompt);
      const rawText = result.response.text().trim();
      
      // Clean up markdown block if model added it
      const cleanJsonStr = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleanJsonStr);
      
      logger.info(`Gemini AI successfully classified event. Intent: ${parsed.intent} | Sentiment: ${parsed.sentiment}`);
      return parsed;
    } catch (err) {
      logger.error("Gemini AI API call failed or JSON parsing failed. Falling back to local rules...", err);
    }
  }

  // Graceful Local Pattern-Matching Rule Engine
  const lowerText = String(userText || "").toLowerCase();
  let intent = "tương tác";
  let sentiment = "trung tính";
  let reply_message = "";

  // 1. Complaint / Negative
  if (
    lowerText.includes("chậm") ||
    lowerText.includes("tệ") ||
    lowerText.includes("chưa nhận") ||
    lowerText.includes("kém") ||
    lowerText.includes("thất vọng") ||
    lowerText.includes("bực") ||
    lowerText.includes("lừa")
  ) {
    intent = "khiếu nại";
    sentiment = "tiêu cực";
    reply_message = `Chào ${cleanName}, chúng tôi rất tiếc vì trải nghiệm không thoải mái này. Nhân viên hỗ trợ sẽ inbox bạn ngay để giải quyết triệt để ạ!`;
  }
  // 2. Price inquiries
  else if (
    lowerText.includes("giá") ||
    lowerText.includes("bao nhiêu") ||
    lowerText.includes("ib") ||
    lowerText.includes("inbox") ||
    lowerText.includes("đắt") ||
    lowerText.includes("rẻ") ||
    lowerText.includes("nhiêu")
  ) {
    intent = "hỏi giá";
    sentiment = "trung tính";
    reply_message = `Chào ${cleanName}, sản phẩm này đang có giá ưu đãi cực tốt ạ! Bạn kiểm tra hộp thư chờ nhé, shop đã gửi thông tin chi tiết qua inbox rồi ạ! 🌸`;
  }
  // 3. Praise / Positive
  else if (
    lowerText.includes("hay") ||
    lowerText.includes("đẹp") ||
    lowerText.includes("tốt") ||
    lowerText.includes("ưng") ||
    lowerText.includes("yêu") ||
    lowerText.includes("like") ||
    lowerText.includes("tuyệt")
  ) {
    intent = "khen ngợi";
    sentiment = "tích cực";
    reply_message = `Cảm ơn ${cleanName} rất nhiều vì những phản hồi tích cực! Sự ủng hộ của bạn là động lực lớn cho shop phát triển tốt hơn! 🥰`;
  }
  // 4. Default Interaction
  else {
    intent = "tương tác";
    sentiment = "trung tính";
    reply_message = `Cảm ơn ${cleanName} đã tương tác cùng trang! Chúc bạn có một ngày tràn ngập niềm vui! ☀️`;
  }

  logger.info(`Local Classifier matched. Intent: ${intent} | Sentiment: ${sentiment}`);
  return {
    intent,
    sentiment,
    reply_message,
  };
}

module.exports = {
  classifyAndDraftReply,
};
