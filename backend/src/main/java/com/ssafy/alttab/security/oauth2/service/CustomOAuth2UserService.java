package com.ssafy.alttab.security.oauth2.service;

import com.ssafy.alttab.security.oauth2.dto.CustomOAuth2User;
import com.ssafy.alttab.security.oauth2.dto.GithubResponse;
import com.ssafy.alttab.member.dto.MemberDto;
import com.ssafy.alttab.security.oauth2.dto.OAuth2Response;
import com.ssafy.alttab.member.entity.Member;
import com.ssafy.alttab.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final MemberRepository memberRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest oAuth2UserRequest) throws OAuth2AuthenticationException {

        OAuth2User oAuth2User = super.loadUser(oAuth2UserRequest);
        System.out.println("oAuth2User = " + oAuth2User);

        String registrationId = oAuth2UserRequest.getClientRegistration().getRegistrationId();

        OAuth2Response oAuth2Response;
        if (registrationId.equals("github")) {
            oAuth2Response = new GithubResponse(oAuth2User.getAttributes());
        } else {
            return null;
        }

        //리소스 서버에서 발급 받은 정보로 사용자를 특정할 아이디값을 만듬
        String username = oAuth2Response.getProvider() + " " + oAuth2Response.getProviderId();
        Optional<Member> existData = memberRepository.findByUsername(username);
        System.out.println("exist Data: " + existData);

        if (existData.isPresent()) {
            Member member = existData.get();
            member.setMemberName(oAuth2Response.getName());
            member.setMemberEmail(oAuth2Response.getEmail());
            member.setMemberAvatarUrl(oAuth2Response.getAvatarUrl());
            member.setMemberHtmlUrl(oAuth2Response.getHtmlUrl());

            memberRepository.save(member);

            MemberDto memberDto = MemberDto.builder()
                    .username(member.getUsername())
                    .memberName(oAuth2Response.getName())
                    .memberEmail(oAuth2Response.getEmail())
                    .memberAvatarUrl(oAuth2Response.getAvatarUrl())
                    .memberHtmlUrl(oAuth2Response.getHtmlUrl())
                    .role("ROLE_USER")
                    .build();

            return new CustomOAuth2User(memberDto);
        } else {
            Member member = Member.builder()
                    .username(username)
                    .memberName(oAuth2Response.getName())
                    .memberEmail(oAuth2Response.getEmail())
                    .memberAvatarUrl(oAuth2Response.getAvatarUrl())
                    .memberHtmlUrl(oAuth2Response.getHtmlUrl())
                    .role("ROLE_USER")
                    .build();

            memberRepository.save(member);

            MemberDto memberDto = MemberDto.builder()
                    .username(member.getUsername())
                    .memberName(oAuth2Response.getName())
                    .memberEmail(oAuth2Response.getEmail())
                    .memberAvatarUrl(oAuth2Response.getAvatarUrl())
                    .memberHtmlUrl(oAuth2Response.getHtmlUrl())
                    .role("ROLE_USER")
                    .build();

            return new CustomOAuth2User(memberDto);
        }
    }
}
