require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.ADMIN_BOT_TOKEN; // Admin bot uchun alohida token
const ADMIN_ID = process.env.ADMIN_ID;

const bot = new TelegramBot(TOKEN, { polling: true });

// Til sozlamalari
const languages = {
  uzb: {
    start: "📥 Kitob qo'shish botiga xush kelibsiz!",
    chooseBookType: "Qaysi turdagi kitob kiritmoqchisiz?",
    sendFile: "📁 Iltimos, kitob faylini yuboring.",
    enterBookName: "📖 Kitob nomini kiriting:",
    enterDescription: "📝 Kitob tavsifini kiriting:",
    enterBookCode: "🔢 Kitob kodini kiriting:",
    enterBookId: "🆔 Kitob ID sini kiriting:",
    confirmData: "Ma'lumotlar to'g'rimi?",
    dataSaved: "✅ Ma'lumotlar saqlandi.",
    dataIncorrect: "❌ Ma'lumotlar noto'g'ri. Qayta kiriting.",
    deleteBook: "🗑️ Kitobni o'chirish",
    editBook: "✏️ Kitobni tahrirlash",
    enterBookIdToDelete: "🆔 O'chirish uchun kitob ID sini kiriting:",
    enterBookIdToEdit: "🆔 Tahrirlash uchun kitob ID sini kiriting:",
    bookDeleted: "✅ Kitob muvaffaqiyatli o'chirildi.",
    bookEdited: "✅ Kitob muvaffaqiyatli tahrirlandi.",
    bookNotFound: "❌ Bunday ID ga ega kitob topilmadi.",
  },
  rus: {
    start: "📥 Добро пожаловать в бота для добавления книг!",
    chooseBookType: "Какой тип книги вы хотите добавить?",
    sendFile: "📁 Пожалуйста, отправьте файл книги.",
    enterBookName: "📖 Введите название книги:",
    enterDescription: "📝 Введите описание книги:",
    enterBookCode: "🔢 Введите код книги:",
    enterBookId: "🆔 Введите ID книги:",
    confirmData: "Данные верны?",
    dataSaved: "✅ Данные сохранены.",
    dataIncorrect: "❌ Данные неверны. Повторите ввод.",
    deleteBook: "🗑️ Удалить книгу",
    editBook: "✏️ Редактировать книгу",
    enterBookIdToDelete: "🆔 Введите ID книги для удаления:",
    enterBookIdToEdit: "🆔 Введите ID книги для редактирования:",
    bookDeleted: "✅ Книга успешно удалена.",
    bookEdited: "✅ Книга успешно отредактирована.",
    bookNotFound: "❌ Книга с таким ID не найдена.",
  },
  eng: {
    start: "📥 Welcome to the book addition bot!",
    chooseBookType: "What type of book do you want to add?",
    sendFile: "📁 Please send the book file.",
    enterBookName: "📖 Enter the book name:",
    enterDescription: "📝 Enter the book description:",
    enterBookCode: "🔢 Enter the book code:",
    enterBookId: "🆔 Enter the book ID:",
    confirmData: "Is the data correct?",
    dataSaved: "✅ Data saved.",
    dataIncorrect: "❌ Data is incorrect. Please re-enter.",
    deleteBook: "🗑️ Delete book",
    editBook: "✏️ Edit book",
    enterBookIdToDelete: "🆔 Enter the book ID to delete:",
    enterBookIdToEdit: "🆔 Enter the book ID to edit:",
    bookDeleted: "✅ Book deleted successfully.",
    bookEdited: "✅ Book edited successfully.",
    bookNotFound: "❌ No book found with this ID.",
  },
};

let userState = {}; // Foydalanuvchi holatini saqlash uchun

// 📌 Botni ishga tushirish
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (msg.from.id.toString() !== ADMIN_ID) {
    bot.sendMessage(chatId, "❌ Sizda ruxsat yo'q.");
    return;
  }
  bot.sendMessage(chatId, languages.uzb.start, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📥 Kitob qo'shish", callback_data: "add_book" }],
        [{ text: "🗑️ Kitobni o'chirish", callback_data: "delete_book" }],
        [{ text: "✏️ Kitobni tahrirlash", callback_data: "edit_book" }],
      ],
    },
  });
});

// 📌 Kitob qo'shish jarayoni
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "add_book") {
    bot.sendMessage(chatId, languages.uzb.chooseBookType, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📹 Video", callback_data: "add_video" }],
          [{ text: "🎧 Audio", callback_data: "add_audio" }],
          [{ text: "📄 PDF", callback_data: "add_pdf" }],
        ],
      },
    });
  } else if (data.startsWith("add_")) {
    const type = data.split("_")[1];
    userState[chatId] = { type, step: "file" };
    bot.sendMessage(chatId, languages.uzb.sendFile);
  } else if (data === "delete_book") {
    userState[chatId] = { step: "delete" };
    bot.sendMessage(chatId, languages.uzb.enterBookIdToDelete);
  } else if (data === "edit_book") {
    userState[chatId] = { step: "edit" };
    bot.sendMessage(chatId, languages.uzb.enterBookIdToEdit);
  }
});

// 📌 Fayl qabul qilish
bot.on("document", (msg) => handleFileUpload(msg, "document"));
bot.on("photo", (msg) => handleFileUpload(msg, "photo"));
bot.on("audio", (msg) => handleFileUpload(msg, "audio"));
bot.on("video", (msg) => handleFileUpload(msg, "video"));

async function handleFileUpload(msg, type) {
  const chatId = msg.chat.id;
  if (!userState[chatId] || userState[chatId].step !== "file") return;

  let fileId, fileName = type;

  if (type === "document") {
    fileId = msg.document.file_id;
    fileName = msg.document.file_name || "Hujjat";
  } else if (type === "photo") {
    fileId = msg.photo[msg.photo.length - 1].file_id;
    fileName = "Rasm";
  } else if (type === "audio") {
    fileId = msg.audio.file_id;
    fileName = msg.audio.title || "Audio";
  } else if (type === "video") {
    fileId = msg.video.file_id;
    fileName = "Video";
  }

  userState[chatId].file_id = fileId;
  userState[chatId].step = "name";
  bot.sendMessage(chatId, languages.uzb.enterBookName);
}

// 📌 Kitob nomini qabul qilish
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!userState[chatId] || userState[chatId].step !== "name") return;

  userState[chatId].name = msg.text.trim();
  userState[chatId].step = "description";
  bot.sendMessage(chatId, languages.uzb.enterDescription);
});

// 📌 Tavsifni qabul qilish
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!userState[chatId] || userState[chatId].step !== "description") return;

  userState[chatId].description = msg.text.trim();
  userState[chatId].step = "code";
  bot.sendMessage(chatId, languages.uzb.enterBookCode);
});

// 📌 Kitob kodini qabul qilish
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!userState[chatId] || userState[chatId].step !== "code") return;

  userState[chatId].code = msg.text.trim();
  userState[chatId].step = "id";
  bot.sendMessage(chatId, languages.uzb.enterBookId);
});

// 📌 Kitob ID sini qabul qilish va tasdiqlash
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!userState[chatId] || userState[chatId].step !== "id") return;

  userState[chatId].id = msg.text.trim();
  const { type, file_id, name, description, code, id } = userState[chatId];

  bot.sendMessage(
    chatId,
    `📂 Fayl turi: ${type}\n📖 Nomi: ${name}\n📝 Tavsifi: ${description}\n🔢 Kodi: ${code}\n🆔 ID: ${id}\n\n${languages.uzb.confirmData}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Ha", callback_data: "confirm_yes" }],
          [{ text: "❌ Yo'q", callback_data: "confirm_no" }],
        ],
      },
    }
  );
});

// 📌 Ma'lumotlarni tasdiqlash
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "confirm_yes") {
    const { type, file_id, name, description, code, id } = userState[chatId];
    const newBook = {
      id,
      name,
      type,
      description,
      code,
      file_id,
    };

    // books.js ga qo'shish
    const booksPath = path.join(__dirname, "books.js");
    const booksData = require(booksPath);
    booksData.push(newBook);
    fs.writeFileSync(booksPath, `module.exports = ${JSON.stringify(booksData, null, 2)};`);

    bot.sendMessage(chatId, languages.uzb.dataSaved);
    delete userState[chatId]; // Holatni tozalash
  } else if (data === "confirm_no") {
    bot.sendMessage(chatId, languages.uzb.dataIncorrect);
    delete userState[chatId]; // Holatni tozalash
  }
});

// 📌 Kitobni o'chirish
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!userState[chatId] || userState[chatId].step !== "delete") return;

  const bookId = msg.text.trim();
  const booksPath = path.join(__dirname, "books.js");
  const booksData = require(booksPath);

  const index = booksData.findIndex((book) => book.id === bookId);
  if (index !== -1) {
    booksData.splice(index, 1); // Kitobni o'chirish
    fs.writeFileSync(booksPath, `module.exports = ${JSON.stringify(booksData, null, 2)};`);
    bot.sendMessage(chatId, languages.uzb.bookDeleted);
  } else {
    bot.sendMessage(chatId, languages.uzb.bookNotFound);
  }
  delete userState[chatId]; // Holatni tozalash
});

// 📌 Kitobni tahrirlash
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!userState[chatId] || userState[chatId].step !== "edit") return;

  const bookId = msg.text.trim();
  const booksPath = path.join(__dirname, "books.js");
  const booksData = require(booksPath);

  const book = booksData.find((book) => book.id === bookId);
  if (book) {
    userState[chatId] = { ...book, step: "edit_book" };
    bot.sendMessage(chatId, `📖 Kitob ma'lumotlari:\n\nNomi: ${book.name}\nTavsifi: ${book.description}\nKodi: ${book.code}\nID: ${book.id}\n\nYangi ma'lumotlarni kiriting:`);
  } else {
    bot.sendMessage(chatId, languages.uzb.bookNotFound);
    delete userState[chatId]; // Holatni tozalash
  }
});

// 📌 Tahrirlash jarayoni
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!userState[chatId] || userState[chatId].step !== "edit_book") return;

  const { id } = userState[chatId];
  const booksPath = path.join(__dirname, "books.js");
  const booksData = require(booksPath);

  const bookIndex = booksData.findIndex((book) => book.id === id);
  if (bookIndex !== -1) {
    const updatedBook = {
      ...booksData[bookIndex],
      name: msg.text.trim(), // Yangi nom
      description: userState[chatId].description, // Tavsif
      code: userState[chatId].code, // Kod
    };
    booksData[bookIndex] = updatedBook;
    fs.writeFileSync(booksPath, `module.exports = ${JSON.stringify(booksData, null, 2)};`);
    bot.sendMessage(chatId, languages.uzb.bookEdited);
  } else {
    bot.sendMessage(chatId, languages.uzb.bookNotFound);
  }
  delete userState[chatId]; // Holatni tozalash
});

console.log("✅ Kitob qo'shish boti ishga tushdi...");