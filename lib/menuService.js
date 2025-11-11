import { createClient } from '@/lib/supabase';

export const menuService = {
  // Save a new menu session
  async saveMenu(menuData, restaurantName, imageUrl) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('menu_sessions')
      .insert({
        user_id: user.id,
        restaurant_name: restaurantName,
        menu_data: menuData,
        image_urls: imageUrl ? [imageUrl] : [],
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get all menus for current user
  async getMenus() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('menu_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get a specific menu by ID
  async getMenu(id) {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('menu_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Update an existing menu
  async updateMenu(id, updates) {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('menu_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete a menu
  async deleteMenu(id) {
    const supabase = createClient();
    
    const { error } = await supabase
      .from('menu_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};