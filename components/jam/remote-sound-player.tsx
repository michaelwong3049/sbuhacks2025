"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import { DrumKit } from "@/app/lib/sound/drum-kit";
import { Piano } from "@/app/lib/sound/piano";
import { Triangle } from "@/app/lib/sound/triangle";
import { SoundEvent } from "@/app/lib/webrtc/peer-manager";

interface RemoteSoundPlayerProps {
  // No props needed - will be controlled via ref
}

export interface RemoteSoundPlayerHandle {
  playRemoteSound: (event: SoundEvent) => void;
}

/**
 * Component that plays sounds from remote peers
 * This allows you to hear other players' sounds in your jam session
 * 
 * Usage: Use the ref to call playRemoteSound when a sound event is received
 */
const RemoteSoundPlayer = forwardRef<RemoteSoundPlayerHandle, RemoteSoundPlayerProps>(
  function RemoteSoundPlayer(_props, ref) {
    const drumKitRef = useRef<DrumKit | null>(null);
    const pianoRef = useRef<Piano | null>(null);
    const triangleRef = useRef<Triangle | null>(null);
    const initializedRef = useRef<boolean>(false);

    // Initialize sound instruments
    useEffect(() => {
      const initSounds = async () => {
        if (initializedRef.current) return;
        
        try {
          // Initialize all instruments (they'll be used when remote sounds come in)
          drumKitRef.current = new DrumKit();
          await drumKitRef.current.initialize();
          
          pianoRef.current = new Piano();
          await pianoRef.current.initialize();
          
          triangleRef.current = new Triangle();
          await triangleRef.current.initialize();
          
          initializedRef.current = true;
          console.log("🎵 Remote sound player initialized");
        } catch (error) {
          console.error("❌ Failed to initialize remote sound player:", error);
        }
      };

      initSounds();
    }, []);

    // Helper function to actually play the sound (defined before useImperativeHandle)
    const playSound = useCallback((event: SoundEvent) => {
      try {
        switch (event.type) {
          case 'drums':
            if (drumKitRef.current) {
              console.log('🔊 Playing remote drum sound:', event.sound);
              switch (event.sound) {
                case 'snare':
                  drumKitRef.current.playSnare();
                  break;
                case 'kick':
                  drumKitRef.current.playKick();
                  break;
                case 'hihat':
                  drumKitRef.current.playHiHat();
                  break;
                case 'crash':
                  drumKitRef.current.playCrash();
                  break;
              }
            } else {
              console.error('❌ DrumKit ref is null');
            }
            break;
          
          case 'piano':
            if (pianoRef.current && event.noteIndex !== undefined) {
              console.log('🎹 Playing remote piano note:', event.noteIndex);
              pianoRef.current.playNote(event.noteIndex, event.velocity || 1);
            } else {
              console.error('❌ Piano ref is null or noteIndex undefined');
            }
            break;
          
          case 'triangle':
            if (triangleRef.current) {
              console.log('🔺 Playing remote triangle');
              triangleRef.current.play();
            } else {
              console.error('❌ Triangle ref is null');
            }
            break;
          
          case 'tambourine':
            // TODO: Implement tambourine sound
            console.log("🎵 Remote tambourine sound (not implemented)");
            break;
        }
      } catch (error) {
        console.error("❌ Error playing remote sound:", error);
      }
    }, []);

    // Expose playRemoteSound method via ref
    useImperativeHandle(ref, () => ({
      playRemoteSound: (event: SoundEvent) => {
        console.log('🎵 playRemoteSound called with event:', event, 'initialized:', initializedRef.current);
        
        if (!initializedRef.current) {
          console.warn("🎵 Remote sound player not yet initialized - will try to initialize now");
          // Try to initialize now
          const initNow = async () => {
            try {
              if (!drumKitRef.current) {
                drumKitRef.current = new DrumKit();
                await drumKitRef.current.initialize();
              }
              if (!pianoRef.current) {
                pianoRef.current = new Piano();
                await pianoRef.current.initialize();
              }
              if (!triangleRef.current) {
                triangleRef.current = new Triangle();
                await triangleRef.current.initialize();
              }
              initializedRef.current = true;
              console.log("🎵 Remote sound player initialized on-demand");
              
              // Now play the sound
              playSound(event);
            } catch (error) {
              console.error("❌ Failed to initialize remote sound player on-demand:", error);
            }
          };
          initNow();
          return;
        }

        playSound(event);
      },
    }), [playSound]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (drumKitRef.current) {
          // DrumKit doesn't have dispose, but we can clear the ref
          drumKitRef.current = null;
        }
        if (pianoRef.current) {
          pianoRef.current.dispose();
          pianoRef.current = null;
        }
        if (triangleRef.current) {
          triangleRef.current.dispose();
          triangleRef.current = null;
        }
        initializedRef.current = false;
      };
    }, []);

    // This component doesn't render anything
    return null;
  }
);

RemoteSoundPlayer.displayName = "RemoteSoundPlayer";

export default RemoteSoundPlayer;
