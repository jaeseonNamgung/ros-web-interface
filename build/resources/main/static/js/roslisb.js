const ros = new ROSLIB.Ros();

function connect() {
    // rosbridge websocket server와의 연결을 생성합니다.
    ros.connect('ws://localhost:9090');

    ros.on('error', function (error) {
        console.log(error);
    });

// 정상 연결
    ros.on('connection', function () {
        console.log('Connection made!');
    });
}
let pathPlanning = new ROSLIB.Topic({
    ros: ros,
    name: 'move_plan',
    messageType : 'nav_msgs/Path' // 경로를 나타내는데 사용
});

// MoveBase는 로봇의 이동을 제어
let pathFeedback = new ROSLIB.Topic({
    ros: ros,
    name: 'move_feedback',
    messageType : 'move_base_msgs/MoveBaseActionFeedback' // 로봇의 이동 상태및 피드백을 제공
})


function mapLoad() {
    let oPerRatingMode = 'nav'

    const createPoseTopic = (oPerRatingMode) => {
        if (oPerRatingMode === 'slam') {
            return new ROSLIB.Topic({
                ros: ros,
                name: 'slam',
                messageType: 'tf2_msgs/TFMessage' //  로봇의 위치와 자세를 추적하고, 센서 데이터를 맵 좌표계에 매핑
            });
        } else {
            return new ROSLIB.Topic({
                ros: ros,
                name: 'nav',
                messageType: 'geometry_msgs/PoseWithCovarianceStamped' // 로봇이나 다른 물체의 위치를 나타내는 데 사용
            });
        }
    }
    let poseTopic = createPoseTopic(oPerRatingMode)
    // Connect to ROS.
// Create the main viewer.
    let viewer = new ROS2D.Viewer({
        divID: 'map', //뷰어가 표시될 HTML 요소의 ID
        width: 1000,
        height: 1000
    });

// Setup the map client.
    let gridClient = new ROS2D.OccupancyGridClient({
        ros: ros,
        rootObject : viewer.scene, // 맵을 표시할 뷰어의 루트 객체를 지정
        image: '/turtlebot.png',
        continuous: true, // occupancy grid가 지속적으로 업데이트되는지 여부를 지정
    });
    gridClient.on('change', function(){
        viewer.scaleToDimensions(gridClient.currentGrid.width, gridClient.currentGrid.height);
        viewer.shift(gridClient.currentGrid.pose.position.x,gridClient.currentGrid.pose.position.y);
    });

// robot odometry
// 화살표 모양의 마커
    let robotMarker = new ROS2D.ArrowShape({
        size: 2.0,
        strokeSize: 0.01,
        pulse: true, //  마커를 깜빡이게 만들지 여부를 지정
        fillColor: createjs.Graphics.getRGB(255,0,0, 0.9),
    });

    // 2D 지도상에 경로를 시각화
    let pathShape = new ROS2D.PathShape({
        strokeSize: 0.03,
        strokeColor: createjs.Graphics.getRGB(0, 255, 0, 0.1)
    });


// 경로가 맵에 추가되어 시각적으로 표시
    gridClient.rootObject.addChild(pathShape);

    pathFeedback.subscribe((message) => {
        if (message) {
            pathShape.setPath(message)
        }
    });

    // 객체를 초기화하는 코드
    let traceShape = new ROS2D.TraceShape({
        strokeSize: 0.1,
        strokeColor: createjs.Graphics.getRGB(255, 0, 0.5),
        maxPoses: 250
    });

    gridClient.rootObject.addChild(traceShape);

    //update on new message
    pathPlanning.subscribe(function (message) {
        traceShape.addPose(message.feedback.base_position.pose);
    });

    const creatInitialPose = (x, y, orientation) => {
        const initialPose = new ROSLIB.Topic({
            ros: ros,
            name: 'initial_pose',
            //  위치와 공분산 정보를 함께 포함
            messageType: 'geometry_msgs/PoseWithCovarianceStamped'
        });

        let posestamped_msg = new ROSLIB.Message({
            header: {
                stamp: {
                    secs: 0,
                    nsecs: 100
                },
                frame_id: "map"
            },
            pose: {
                position: {
                    x: x,
                    y: y,
                    z: 0.0
                },
                orientation: orientation,
                covariance: [0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.06853892326654787]
            },
        });
        initialPose.publish(posestamped_msg)
    }

    const createGoalPose = (x, y, orientation) => {
        const goalPose = new ROSLIB.Topic({
            ros: ros,
            name: 'goal_pose',
            // 목표 지점을 표현하는 데 사용
            messageType: 'geometry_msgs/PoseStamped'
        });

        let posestamped_msg = new ROSLIB.Message({
            header: {
                stamp: {
                    secs: 0,
                    nsecs: 100
                },
                frame_id: "map"
            },
            pose: {
                position: {
                    x: x,
                    y: y,
                    z: 0.0
                },
                orientation: orientation
            }
        });

        goalPose.publish(posestamped_msg)
    }

    let mouseDown = false
    let mouseDownPose = {}

    let mouseEventHandler = function (event, mouseState, oPerMode) {
        if (mouseState === 'down') {
            mouseDown = true

            //  이 메서드는 웹 페이지에서의 마우스 이벤트의 좌표를 ROS 좌표로 변환합니다.
            mouseDownPosition = viewer.scene.globalToRos(event.stageX, event.stageY);
            mouseDownPositionVec3 = new ROSLIB.Vector3(mouseDownPosition);
            mouseDownPose = new ROSLIB.Pose({
                position: mouseDownPositionVec3
            })
        } else if (mouseState === 'move' && mouseDown) {
            // // 이전 마커를 삭제
            gridClient.rootObject.removeChild(robotMarker);
        } else if (mouseState === 'up' && mouseDown) {
            mouseDown = false
            mouseUpPosition = viewer.scene.globalToRos(event.stageX, event.stageY);
            mouseUpPositionVec3 = new ROSLIB.Vector3(mouseUpPosition);
            const mouseUpPose = new ROSLIB.Pose({
                position: mouseUpPositionVec3
            });

            // upPose - DownPose
            // 마우스를 놓은 위치와 누른 위치를 계산함으로써 이동한 거리를 계산
            xDelta =  mouseUpPose.position.x - mouseDownPose.position.x ;
            yDelta =  mouseUpPose.position.y - mouseDownPose.position.y;

            // 두 점 간의 각도를 계산
            thetaRadians  = Math.atan2(xDelta,yDelta);

            thetaDegrees = thetaRadians * (180.0 / Math.PI);

            // 주어진 각도(thetaRadians)를 수정하는 부분으로, 주어진 각도가 0에서 π(파이)
            // 사이에 있는지 확인하고, 그렇다면 각도에 추가 조정을 수행
            if (thetaRadians >= 0 && thetaRadians <= Math.PI) {
                thetaRadians += (3 * Math.PI / 2);
            } else {
                thetaRadians -= (Math.PI/2);
            }
            //  코드에서는 주어진 각도를 사용하여 로봇의 방향을 나타내는 쿼터니언 값을 계산
            var qz =  Math.sin(-thetaRadians/2.0);
            var qw =  Math.cos(-thetaRadians/2.0);

            // degree convert to quaternion
            // 방향을 표현
            var orientation = new ROSLIB.Quaternion({x:0, y:0, z:qz, w:qw});

            // set robotmaker
            if(oPerMode==="initial"){
                creatInitialPose(mouseDownPose.position.x,mouseDownPose.position.y,orientation)
            }else if (oPerMode==="goal")
                createGoalPose(mouseDownPose.position.x,mouseDownPose.position.y,orientation)
        }};

    viewer.scene.addEventListener('stagemousedown', function(event) {
        let initialPoseChecked = document.querySelector("#initialPoseswitch").checked
        let goalPoseChecked = document.querySelector("#goalPoseswitch").checked
        // set Btn control
        let oPerMode=initialPoseChecked ? "initial": "goal"
        // button to set inital pose
        if(initialPoseChecked){
            document.querySelector("#goalPoseswitch").checked=false
            mouseEventHandler(event,'down',oPerMode);
        }

        if(goalPoseChecked){
            document.querySelector("#initialPoseswitch").checked=false
            mouseEventHandler(event,'down',oPerMode);
        }

    });

    viewer.scene.addEventListener('stagemousemove', function(event) {
        let initialPoseChecked = document.querySelector("#initialPoseswitch").checked
        let goalPoseChecked = document.querySelector("#goalPoseswitch").checked
        let oPerMode=initialPoseChecked?"initial":"goal"
        // button to set inital pose
        if(initialPoseChecked){
            document.querySelector("#goalPoseswitch").checked=false
            mouseEventHandler(event,'move',oPerMode);
        }

        if(goalPoseChecked){
            document.querySelector("#initialPoseswitch").checked=false
            mouseEventHandler(event,'move',oPerMode);
        }

    });

    viewer.scene.addEventListener('stagemouseup', function(event) {
        let initialPoseChecked = document.querySelector("#initialPoseswitch").checked
        let goalPoseChecked = document.querySelector("#goalPoseswitch").checked
        let oPerMode=initialPoseChecked?"initial":"goal"
        // button to set inital pose
        if(initialPoseChecked){
            document.querySelector("#goalPoseswitch").checked=false
            mouseEventHandler(event,'up',oPerMode);
        }

        if(goalPoseChecked){
            document.querySelector("#initialPoseswitch").checked=false
            mouseEventHandler(event,'up',oPerMode);
        }

    });

    const createFunc = function (handlerToCall, discriminator, robotMarker,oPerRatingMode) {


        return discriminator.subscribe(function(pose){

            if (oPerRatingMode==="slam"){
                // slam
                // CrtoGrapher slam case(tf2_msgs/TFMessage)
                let odomPose = pose.transforms[0].transform.translation
                let baseLinkPose=pose.transforms[1].transform.translation

                //  When using Nav,  gemometry_msgs/Pose .orientation. {x,y,z,w} (Quarternion)
                //  When using SLAM  tf2_msgs/TFMessage .transform . rotation  {x,y,z,w} (quarternion)
                let quaZ=pose.transforms[1].transform.rotation.z

                // pose using odom
                robotMarker.x = baseLinkPose.x;
                robotMarker.y = -baseLinkPose.y;

                let degreeZ = 0;
                if( quaZ >= 0 ) {
                    degreeZ = quaZ / 1 * 180
                } else {
                    degreeZ = (-quaZ) * 180 + 180
                };
                // degree
                robotMarker.rotation = degreeZ;

            }else if(oPerRatingMode==="nav"){
                // navigation
                robotMarker.x = pose.pose.pose.position.x;
                robotMarker.y = -pose.pose.pose.position.y;

                let orientationQuerter=pose.pose.pose.orientation
                let q0 = orientationQuerter.w;
                let q1 = orientationQuerter.x;
                let q2 = orientationQuerter.y;
                let q3 = orientationQuerter.z;
                degree=-Math.atan2(2 * (q0 * q3 + q1 * q2), 1 - 2 * (q2 * q2 + q3 * q3)) * 180.0 / Math.PI
                robotMarker.rotation = degree;
            }

            // rootObject를 통해서 robotMaker에 Marker 넣어줌
            gridClient.rootObject.addChild(robotMarker);

        })
    }

    // navigation pose / tf
    createFunc('subscribe',poseTopic, robotMarker, oPerRatingMode);

    // Scale the canvas to fit to the map
    gridClient.on('change', function(){
        viewer.scaleToDimensions(gridClient.currentGrid.width, gridClient.currentGrid.height);
        viewer.shift(gridClient.currentGrid.pose.position.x, gridClient.currentGrid.pose.position.y);
    });
}

// window.onload는 최종에 있는거 한번만 실행됨
document.addEventListener('DOMContentLoaded', function() {
    connect();
    mapLoad();
});


