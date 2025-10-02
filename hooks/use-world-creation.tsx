import { useState } from 'react';
import { Alert } from 'react-native';
import { worldsDB } from '../lib/database/worlds';

interface WorldFormData {
  name: string;
  description: string;
  system: string;
  isDM: boolean;
  mapImageUrl?: string;
}

export function useWorldCreation() {
  const [isCreating, setIsCreating] = useState(false);
  const [successWorldName, setSuccessWorldName] = useState('');
  const [successWorldId, setSuccessWorldId] = useState('');

  const createWorld = async (formData: WorldFormData) => {
    setIsCreating(true);
    
    try {
      const newWorld = await worldsDB.create({
        name: formData.name.trim(),
        description: formData.description.trim() || '',
        system: formData.system,
        is_dm: formData.isDM,
        map_image_url: formData.mapImageUrl || 'https://media.wizards.com/2015/images/dnd/resources/Sword-Coast-Map_MedRes.jpg'
      });

      // Capture the world details for success modal and navigation
      setSuccessWorldName(newWorld.name);
      setSuccessWorldId(newWorld.world_id);
      
      return { success: true, world: newWorld };
    } catch (error) {
      console.error('Create world error:', error);
      Alert.alert(
        'Error', 
        'Failed to create world. Please check your connection and try again.'
      );
      return { success: false, error };
    } finally {
      setIsCreating(false);
    }
  };

  return {
    isCreating,
    successWorldName,
    successWorldId,
    createWorld,
    setSuccessWorldName,
    setSuccessWorldId
  };
}