

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Gemini API key is not configured"
      })
    };
  }

  try {
    const {
      message,
      action,
      prompt,
      imageBase64,
      mimeType
    } = JSON.parse(event.body || "{}");

    // IMAGE GENERATION AND EDITING
    if (action === "generateImage") {
      if (!prompt || typeof prompt !== "string") {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "An image prompt is required"
          })
        };
      }

      if (prompt.length > 4000) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Image prompt is too long"
          })
        };
      }

      const parts = [];

      if (imageBase64) {
        const cleanImage = imageBase64.replace(
          /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
          ""
        );

        const allowedTypes = [
          "image/png",
          "image/jpeg",
          "image/webp"
        ];

        if (!allowedTypes.includes(mimeType)) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: "Unsupported image format"
            })
          };
        }

        if (cleanImage.length > 8000000) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: "Image is too large"
            })
          };
        }

        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanImage
          }
        });
      }

      parts.push({
        text: prompt
      });

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: parts
            }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"]
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          statusCode: response.status,
          body: JSON.stringify({
            error: data.error?.message ||
              "Image generation failed"
          })
        };
      }

      const outputParts =
        data.candidates?.[0]?.content?.parts || [];

      const generatedImage = outputParts.find(
        part => part.inlineData?.data
      );

      if (!generatedImage) {
        return {
          statusCode: 502,
          body: JSON.stringify({
            error: "Gemini did not return an image. Try again."
          })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          image: generatedImage.inlineData.data,
          mimeType: generatedImage.inlineData.mimeType,
          reply: "Your image is ready!"
        })
      };
    }

    // EXISTING TEXT CHAT
    if (!message || typeof message !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "A message is required"
        })
      };
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: message }]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: data.error?.message ||
            "Gemini request failed"
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        reply:
          data.candidates?.[0]?.content?.parts?.[0]?.text ||
          "No response received."
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server error. Please try again."
      })
    };
  }
};
        


