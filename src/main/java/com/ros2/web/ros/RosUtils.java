package com.ros2.web.ros;

import edu.wpi.rail.jrosbridge.Ros;
import edu.wpi.rail.jrosbridge.Topic;
import edu.wpi.rail.jrosbridge.callback.TopicCallback;
import edu.wpi.rail.jrosbridge.handler.RosHandler;
import org.springframework.beans.factory.annotation.Value;

import javax.annotation.PostConstruct;
import javax.websocket.Session;
import java.util.LinkedHashMap;

public class RosUtils implements RosHandler {

    @Value("ros.ip")
    private String ip;
    @Value("ros.port")
    private String port;

    private TopicCallback topicCallback;
    private LinkedHashMap <String,String> map;

    private Ros ros = null;
    private boolean connect = false;


    @PostConstruct
    void init(){
        try{
            ros = new Ros(ip);
            connect = ros.connect();
            if(connect){
                for (String key : map.keySet()) {
                    Topic topic = new Topic(ros, key, map.get(key));
                    topic.subscribe(topicCallback);
                }

                ros.addRosHandler(this);
            }
        }catch (Exception e){
            System.out.println("ROS 연결 실패: " + e.toString());
            connect = false;
        }
    }

    @Override
    public void handleConnection(Session session) {
        System.out.println("ROS 연결" + session.getId());
    }
    @Override
    public void handleDisconnection(Session session) {
        System.out.println("ROS 연결 종료" + session.getId());
    }

    @Override
    public void handleError(Session session, Throwable t) {
        System.out.println("ros 연결 실패 " + session.getId() +
                ", 실패 원인: " + t.toString());
        connect = false;
    }
}
