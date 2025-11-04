import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;
export async function POST(request) {
  try {
    const { image, mediaType } = await request.json();

    if (!image) {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Send image to Claude for analysis
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: image,
              },
            },
            {
              type: 'text',
              text: `Analyze this restaurant menu image and extract all menu items in a structured format. 

For each menu item, provide:
- name: The dish name
- price: The price (if visible)
- description: Brief description (if available)
- category: Type of dish (appetizer, main, dessert, beverage, etc.)
- ingredients: List of main ingredients mentioned
- allergens: Common allergens present (nuts, dairy, gluten, shellfish, etc.)
- dietary: Any dietary tags (vegetarian, vegan, gluten-free, etc.)

Also identify the restaurant name if visible.

Return ONLY valid JSON in this exact format:
{
  "restaurant_name": "Restaurant Name or null",
  "items": [
    {
      "name": "Dish Name",
      "price": "$X.XX or null",
      "description": "Description or null",
      "category": "Category",
      "ingredients": ["ingredient1", "ingredient2"],
      "allergens": ["allergen1"],
      "dietary": ["tag1", "tag2"]
    }
  ]
}

Be thorough and extract all visible menu items.`,
            },
          ],
        },
      ],
    });

    // Extract the text content from Claude's response
    const responseText = message.content[0].text;
    
    // Parse JSON from response (Claude should return clean JSON)
    let menuData;
    try {
      // Remove any markdown code blocks if present
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      menuData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText);
      return Response.json(
        { error: 'Failed to parse menu data', details: responseText },
        { status: 500 }
      );
    }

    return Response.json({ menu: menuData });
  } catch (error) {
    console.error('Error analyzing menu:', error);
    return Response.json(
      { error: 'Failed to analyze menu', details: error.message },
      { status: 500 }
    );
  }
}