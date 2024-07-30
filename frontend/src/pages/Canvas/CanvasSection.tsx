import React, { useEffect, useState, useRef } from "react";
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { fabric } from 'fabric';
import Toolbar from './Toolbar';
import styles from './CanvasSection.module.scss';
import CloseSVG from '@/assets/icons/close.svg?react';
import { compressData, decompressData } from './CompressUtil';

function App() {
  const stompClient = useRef<Client | null>(null);
  const [roomId, setRoomId] = useState('');
  const [connected, setConnected] = useState(false);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [pendingDrawingData, setPendingDrawingData] = useState<any>(null);

  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const handleIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRoomId(event.target.value);
  };

  const connect = () => {
    if (stompClient.current && stompClient.current.connected) return;

    const socket = new SockJS('http://localhost:8080/ws');
    stompClient.current = new Client({
      webSocketFactory: () => socket as any,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    stompClient.current.onConnect = (frame) => {
      if (stompClient.current) {
        stompClient.current.subscribe(`/sub/api/v1/rooms/${roomId}`, (message) => {
          const newMessage = JSON.parse(message.body);
          updateCanvas(newMessage);
        });
      }

      reconnectAttemptsRef.current = 0;
      setConnected(true);
    };

    stompClient.current.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };

    stompClient.current.onWebSocketClose = () => {
      setConnected(false);
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current += 1;
        setTimeout(() => {
          connect();
        }, Math.min(5000 * reconnectAttemptsRef.current, 60000));
      } else {
        console.log("Max reconnect attempts reached.");
      }
    };

    stompClient.current.activate();
  };

  const disconnect = () => {
    if (stompClient.current) {
      stompClient.current.deactivate();
      setConnected(false);
    }
  };

  const sendDrawingData = (drawingData: any) => {
    if (!stompClient.current?.connected) return;

    try {
      const compressedData = compressData(JSON.stringify(drawingData));
      const payload = {
        roomId: roomId,
        drawingData: compressedData
      };

      stompClient.current.publish({
        destination: `/pub/api/v1/rooms/${roomId}`,
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Error compressing data:', error);
    }
  };

  const handleConnectClick = () => {
    if (roomId) {
      connect();
    } else {
      alert("아이디를 입력해주세요.");
    }
  };

  const updateCanvas = (newMessage: any) => {
    try {
      const decompressedData = decompressData(newMessage.drawingData);
      const drawingData = JSON.parse(decompressedData);

      if (fabricCanvasRef.current) {
        applyDrawingData(drawingData);
      } else {
        setPendingDrawingData(drawingData);
      }
    } catch (error) {
      console.error('Error decompressing or parsing data:', error);
    }
  };

  const applyDrawingData = async (drawingData: any) => {
    try {
      if (Array.isArray(drawingData.objects)) {
        fabricCanvasRef.current!.clear();
        for (const obj of drawingData.objects) {
          await new Promise<void>((resolve) => {
            fabric.util.enlivenObjects([obj], (enlivenedObjects: fabric.Object[]) => {
              enlivenedObjects.forEach((enlivenedObj) => {
                fabricCanvasRef.current!.add(enlivenedObj);
              });
              resolve();
            }, 'fabric');
          });
        }
      }
    } catch (error) {
      console.error('Error updating canvas:', error);
    }
  };

  const toggleCanvasVisibility = () => {
    setCanvasVisible(!canvasVisible);
  };

  useEffect(() => {
    if (!canvasContainerRef.current || !canvasRef.current) return;

    const canvasContainer = canvasContainerRef.current;
    // 캔버스 생성
    const newCanvas = new fabric.Canvas(canvasRef.current, {
      width: canvasContainer.offsetWidth,
      height: canvasContainer.offsetHeight,
    });

    setCanvas(newCanvas);
    fabricCanvasRef.current = newCanvas;
    newCanvas.backgroundColor = 'transparent';

    if (pendingDrawingData) {
      applyDrawingData(pendingDrawingData);
      setPendingDrawingData(null);
    }

    newCanvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = newCanvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 10) zoom = 10;
      if (zoom < 0.1) zoom = 0.1;
      newCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    newCanvas.on('mouse:up', (e) => {
      sendDrawingData(newCanvas.toJSON(['data']));
    });

    const handleResize = () => {
      newCanvas.setDimensions({
        width: canvasContainer.offsetWidth,
        height: canvasContainer.offsetHeight,
      });
    };

    window.addEventListener('resize', handleResize);

    newCanvas.freeDrawingBrush.width = 10;
    newCanvas.isDrawingMode = true;

    return () => {
      newCanvas.dispose();
      window.removeEventListener('resize', handleResize);
      disconnect();
      fabricCanvasRef.current = null;
    };
  }, [canvasVisible]);

  useEffect(() => {
    if (fabricCanvasRef.current && roomId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [roomId]);

  return (
    <div>
      <div>
        <input
          type="text"
          placeholder="방 ID 입력"
          value={roomId}
          onChange={handleIdChange}
        />
        <button onClick={handleConnectClick} disabled={connected}>연결</button>
        <button onClick={toggleCanvasVisibility}>
          {canvasVisible ? "캔버스 닫기" : "캔버스 열기"}
        </button>
      </div>
      {canvasVisible && (
        <div className={styles.canvas} ref={canvasContainerRef}>
          <button className={styles.closeButton} onClick={toggleCanvasVisibility}>
            <CloseSVG width={24} height={24} stroke="#F24242" />
          </button>
          <canvas ref={canvasRef} />
          <Toolbar canvas={canvas} />
        </div>
      )}
    </div>
  );
}

export default App;