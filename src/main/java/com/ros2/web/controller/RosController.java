package com.ros2.web.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class RosController {


    @GetMapping("/")
    public String index(){
        return "index";
    }
}
